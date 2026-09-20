package app.kinshipcapital.companion

import android.content.Context
import android.util.Log
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Posts a single SMS to the Kinship Capital ingestion endpoint.
 * POST {baseUrl}/api/transactions/sms  (public route: /api/public/transactions/sms)
 * Authorization: Bearer <device_token>
 */
object SmsUploader {

    private const val TAG = "KinshipSmsUploader"
    private const val PATH = "/api/public/transactions/sms"

    /** Only forward messages from money senders. */
    private val MONEY_SENDERS = listOf("MPESA", "M-PESA", "KCB", "EQUITY", "SAFARICOM")

    fun isMoneySender(sender: String?): Boolean {
        val s = (sender ?: "").uppercase(Locale.ROOT)
        return MONEY_SENDERS.any { s.contains(it) }
    }

    fun iso(timestampMillis: Long): String {
        val fmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
        fmt.timeZone = TimeZone.getTimeZone("UTC")
        return fmt.format(Date(timestampMillis))
    }

    /** Returns true when the server accepted the message. */
    fun send(context: Context, sender: String, body: String, receivedAtMillis: Long): Boolean {
        val prefs = Prefs(context)
        if (!prefs.isPaired) {
            Log.w(TAG, "Device not paired yet - message skipped")
            return false
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
            Log.i(TAG, "Upload response: $code")
            code in 200..299
        } catch (e: Exception) {
            Log.e(TAG, "Upload failed", e)
            false
        } finally {
            connection?.disconnect()
        }
    }
}
