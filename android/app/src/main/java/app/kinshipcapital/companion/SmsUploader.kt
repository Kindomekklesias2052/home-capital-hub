package app.kinshipcapital.companion

import android.content.Context
import android.util.Log
import androidx.work.Data
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Posts a single SMS to the Kinship Capital ingestion endpoint.
 * POST {baseUrl}/api/public/transactions/sms
 * Authorization: Bearer <device_token>
 */
object SmsUploader {

    private const val TAG = "KinshipSmsUploader"
    private const val PATH = "/api/public/transactions/sms"

    /** Only forward messages from money senders. */
    private val MONEY_SENDERS = listOf("MPESA", "M-PESA", "KCB", "EQUITY", "SAFARICOM")

    sealed class Outcome {
        object Sent : Outcome()
        object Duplicate : Outcome()
        object Unrecognised : Outcome()
        data class Failed(val reason: String, val retryable: Boolean) : Outcome()
    }

    fun isMoneySender(sender: String?): Boolean {
        val s = (sender ?: "").uppercase(Locale.ROOT)
        return MONEY_SENDERS.any { s.contains(it) }
    }

    fun iso(timestampMillis: Long): String {
        val fmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
        fmt.timeZone = TimeZone.getTimeZone("UTC")
        return fmt.format(Date(timestampMillis))
    }

    /**
     * Records the message in the sync history and queues it for upload.
     * Messages already delivered are skipped so the ledger never gets duplicates.
     */
    fun enqueue(context: Context, sender: String, body: String, receivedAt: Long, force: Boolean = false) {
        val id = SyncLog.fingerprint(sender, body, receivedAt)
        if (!force && SyncLog.alreadyDelivered(context, id)) return
        SyncLog.record(context, id, sender, body, receivedAt, SyncLog.Status.PENDING,
            SyncLog.find(context, id)?.lastError)

        val data = Data.Builder()
            .putString(SmsUploadWorker.KEY_ID, id)
            .putString(SmsUploadWorker.KEY_SENDER, sender)
            .putString(SmsUploadWorker.KEY_BODY, body)
            .putLong(SmsUploadWorker.KEY_RECEIVED_AT, receivedAt)
            .build()

        // Unique work per message: queuing the same text twice keeps only one upload.
        WorkManager.getInstance(context).enqueueUniqueWork(
            "sms-$id",
            ExistingWorkPolicy.KEEP,
            OneTimeWorkRequestBuilder<SmsUploadWorker>()
                .setConstraints(SmsUploadWorker.constraints())
                .setInputData(data)
                .build()
        )
    }

    /** Re-queues every failed message. Returns how many were retried. */
    fun retryFailed(context: Context): Int {
        val failed = SyncLog.all(context).filter { it.status == SyncLog.Status.FAILED }
        failed.forEach { enqueue(context, it.sender, it.body, it.receivedAt, force = true) }
        return failed.size
    }

    fun send(context: Context, sender: String, body: String, receivedAtMillis: Long): Outcome {
        val prefs = Prefs(context)
        if (!prefs.isPaired) {
            Log.w(TAG, "Device not paired yet - message skipped")
            return Outcome.Failed("Phone not paired yet", retryable = false)
        }

        val payload = JSONObject().apply {
            put("sms_body", body)
            put("sender", sender.take(64))
            put("received_at", iso(receivedAtMillis))
            put("device_id", prefs.deviceId)
        }

        var connection: HttpURLConnection? = null
        return try {
            connection = (URL(prefs.baseUrl + PATH).openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 15000
                readTimeout = 20000
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("Authorization", "Bearer ${prefs.deviceToken}")
            }
            connection.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
            val code = connection.responseCode
            val text = (if (code in 200..299) connection.inputStream else connection.errorStream)
                ?.bufferedReader()?.use { it.readText() } ?: ""
            val status = runCatching { JSONObject(text).optString("status") }.getOrDefault("")
            Log.i(TAG, "Upload response: $code $status")
            when {
                status == "duplicate" -> Outcome.Duplicate
                status == "stored_unparsed" -> Outcome.Unrecognised
                code in 200..299 -> Outcome.Sent
                code == 401 || code == 403 -> Outcome.Failed("Pairing rejected - re-pair this phone", retryable = false)
                code in 400..499 -> Outcome.Failed("Server refused the message ($code)", retryable = false)
                else -> Outcome.Failed("Server error ($code)", retryable = true)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Upload failed", e)
            Outcome.Failed("No connection: ${e.javaClass.simpleName}", retryable = true)
        } finally {
            connection?.disconnect()
        }
    }
}
