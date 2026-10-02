package app.kinshipcapital.companion

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.NetworkType
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** Uploads one message, retrying automatically when offline, and records the result in the sync history. */
class SmsUploadWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val sender = inputData.getString(KEY_SENDER) ?: return@withContext Result.failure()
        val body = inputData.getString(KEY_BODY) ?: return@withContext Result.failure()
        val receivedAt = inputData.getLong(KEY_RECEIVED_AT, System.currentTimeMillis())
        val id = inputData.getString(KEY_ID) ?: SyncLog.fingerprint(sender, body, receivedAt)
        val ctx = applicationContext

        when (val outcome = SmsUploader.send(ctx, sender, body, receivedAt)) {
            SmsUploader.Outcome.Sent -> {
                SyncLog.record(ctx, id, sender, body, receivedAt, SyncLog.Status.SENT); Result.success()
            }
            SmsUploader.Outcome.Duplicate -> {
                SyncLog.record(ctx, id, sender, body, receivedAt, SyncLog.Status.DUPLICATE); Result.success()
            }
            SmsUploader.Outcome.Unrecognised -> {
                SyncLog.record(ctx, id, sender, body, receivedAt, SyncLog.Status.UNRECOGNISED); Result.success()
            }
            is SmsUploader.Outcome.Failed -> {
                if (outcome.retryable && runAttemptCount < 5) {
                    SyncLog.record(ctx, id, sender, body, receivedAt, SyncLog.Status.PENDING, outcome.reason)
                    Result.retry()
                } else {
                    SyncLog.record(ctx, id, sender, body, receivedAt, SyncLog.Status.FAILED, outcome.reason)
                    Result.failure()
                }
            }
        }
    }

    companion object {
        const val KEY_ID = "id"
        const val KEY_SENDER = "sender"
        const val KEY_BODY = "body"
        const val KEY_RECEIVED_AT = "received_at"

        fun constraints(): Constraints =
            Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
    }
}
