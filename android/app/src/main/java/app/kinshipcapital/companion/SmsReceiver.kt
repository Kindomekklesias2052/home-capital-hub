package app.kinshipcapital.companion

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony

/** Listens for incoming texts and queues money messages for upload. */
class SmsReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
        if (messages.isEmpty()) return

        // Multipart texts arrive as several parts of the same message.
        val sender = messages[0].displayOriginatingAddress ?: return
        if (!SmsUploader.isMoneySender(sender)) return

        val body = messages.joinToString("") { it.displayMessageBody ?: "" }
        if (body.isBlank()) return
        val receivedAt = messages[0].timestampMillis

        SmsUploader.enqueue(context, sender, body, receivedAt)
    }
}
