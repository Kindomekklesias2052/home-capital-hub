package app.kinshipcapital.companion

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest

/**
 * Local history of every money message the app tried to send.
 * The id is a fingerprint of sender + body + time, so the same text is never sent twice.
 */
object SyncLog {

    enum class Status { PENDING, SENT, DUPLICATE, UNRECOGNISED, FAILED }

    data class Entry(
        val id: String,
        val sender: String,
        val body: String,
        val receivedAt: Long,
        val status: Status,
        val attempts: Int,
        val lastError: String?,
        val updatedAt: Long,
    )

    private const val PREFS = "kinship_sync_log"
    private const val KEY = "entries"
    private const val MAX_ENTRIES = 300

    fun fingerprint(sender: String, body: String, receivedAt: Long): String {
        val bytes = MessageDigest.getInstance("SHA-256")
            .digest("$sender|$body|$receivedAt".toByteArray(Charsets.UTF_8))
        return bytes.joinToString("") { "%02x".format(it) }.take(32)
    }

    @Synchronized
    fun all(context: Context): List<Entry> {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, "[]") ?: "[]"
        val arr = JSONArray(raw)
        return (0 until arr.length()).map { i ->
            val o = arr.getJSONObject(i)
            Entry(
                id = o.getString("id"),
                sender = o.getString("sender"),
                body = o.getString("body"),
                receivedAt = o.getLong("receivedAt"),
                status = Status.valueOf(o.getString("status")),
                attempts = o.optInt("attempts", 0),
                lastError = if (o.isNull("lastError")) null else o.optString("lastError"),
                updatedAt = o.optLong("updatedAt", 0),
            )
        }.sortedByDescending { it.receivedAt }
    }

    fun find(context: Context, id: String): Entry? = all(context).firstOrNull { it.id == id }

    /** True when this exact message was already delivered (or the server already had it). */
    fun alreadyDelivered(context: Context, id: String): Boolean =
        find(context, id)?.status.let { it == Status.SENT || it == Status.DUPLICATE || it == Status.UNRECOGNISED }

    @Synchronized
    fun upsert(context: Context, entry: Entry) {
        val list = all(context).filterNot { it.id == entry.id }.toMutableList()
        list.add(0, entry)
        val arr = JSONArray()
        list.sortedByDescending { it.receivedAt }.take(MAX_ENTRIES).forEach { e ->
            arr.put(
                JSONObject()
                    .put("id", e.id).put("sender", e.sender).put("body", e.body)
                    .put("receivedAt", e.receivedAt).put("status", e.status.name)
                    .put("attempts", e.attempts).put("lastError", e.lastError ?: JSONObject.NULL)
                    .put("updatedAt", e.updatedAt)
            )
        }
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, arr.toString()).apply()
    }

    fun record(context: Context, id: String, sender: String, body: String, receivedAt: Long, status: Status, error: String? = null) {
        val prev = find(context, id)
        val attempts = (prev?.attempts ?: 0) + if (status == Status.PENDING) 0 else 1
        upsert(context, Entry(id, sender, body, receivedAt, status, attempts, error, System.currentTimeMillis()))
    }
}
