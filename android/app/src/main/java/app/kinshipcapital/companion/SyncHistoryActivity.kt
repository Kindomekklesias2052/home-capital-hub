package app.kinshipcapital.companion

import android.os.Bundle
import android.text.format.DateUtils
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.button.MaterialButton
import com.google.android.material.card.MaterialCardView

/** Shows which money messages were sent, which failed, and lets the user retry failures. */
class SyncHistoryActivity : AppCompatActivity() {

    private lateinit var list: LinearLayout
    private lateinit var summary: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        title = getString(R.string.sync_history)
        val pad = (16 * resources.displayMetrics.density).toInt()

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(pad, pad, pad, pad)
        }
        summary = TextView(this).apply { textSize = 14f }
        val retry = MaterialButton(this).apply {
            text = getString(R.string.retry_failed)
            setOnClickListener {
                val n = SmsUploader.retryFailed(this@SyncHistoryActivity)
                Toast.makeText(this@SyncHistoryActivity,
                    if (n == 0) getString(R.string.nothing_to_retry) else getString(R.string.retrying, n),
                    Toast.LENGTH_SHORT).show()
                render()
            }
        }
        val refresh = MaterialButton(this, null, com.google.android.material.R.attr.materialButtonOutlinedStyle).apply {
            text = getString(R.string.refresh)
            setOnClickListener { render() }
        }
        list = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }

        root.addView(summary)
        root.addView(retry)
        root.addView(refresh)
        root.addView(list)
        setContentView(ScrollView(this).apply { addView(root) })
        render()
    }

    override fun onResume() {
        super.onResume()
        render()
    }

    private fun label(s: SyncLog.Status) = when (s) {
        SyncLog.Status.SENT -> getString(R.string.st_sent)
        SyncLog.Status.DUPLICATE -> getString(R.string.st_duplicate)
        SyncLog.Status.UNRECOGNISED -> getString(R.string.st_unrecognised)
        SyncLog.Status.PENDING -> getString(R.string.st_pending)
        SyncLog.Status.FAILED -> getString(R.string.st_failed)
    }

    private fun render() {
        val entries = SyncLog.all(this)
        val failed = entries.count { it.status == SyncLog.Status.FAILED }
        val sent = entries.count { it.status == SyncLog.Status.SENT }
        summary.text = getString(R.string.sync_summary, entries.size, sent, failed)
        list.removeAllViews()
        val gap = (8 * resources.displayMetrics.density).toInt()
        if (entries.isEmpty()) {
            list.addView(TextView(this).apply { text = getString(R.string.sync_empty); setPadding(0, gap * 2, 0, 0) })
            return
        }
        entries.forEach { e ->
            val card = MaterialCardView(this).apply {
                layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
                    .apply { topMargin = gap }
                setContentPadding(gap * 2, gap * 2, gap * 2, gap * 2)
            }
            val when_ = DateUtils.getRelativeTimeSpanString(e.receivedAt)
            val text = buildString {
                append("${label(e.status)} · ${e.sender} · $when_")
                if (e.attempts > 1) append(" · ${e.attempts} tries")
                if (!e.lastError.isNullOrBlank() && e.status != SyncLog.Status.SENT) append("\n${e.lastError}")
                append("\n\n${e.body.take(160)}")
            }
            card.addView(TextView(this).apply { this.text = text; textSize = 13f })
            list.addView(card)
        }
    }
}
