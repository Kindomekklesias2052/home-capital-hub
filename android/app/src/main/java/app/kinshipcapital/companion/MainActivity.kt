package app.kinshipcapital.companion

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import app.kinshipcapital.companion.databinding.ActivityMainBinding
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import androidx.lifecycle.lifecycleScope

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var prefs: Prefs

    private val requestPermissions =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result ->
            val granted = result.values.all { it }
            updateStatus(granted)
            if (!granted) {
                Toast.makeText(
                    this,
                    getString(R.string.permission_needed),
                    Toast.LENGTH_LONG
                ).show()
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        prefs = Prefs(this)

        binding.baseUrlInput.setText(prefs.baseUrl)
        binding.deviceIdInput.setText(prefs.deviceId)
        binding.deviceTokenInput.setText(prefs.deviceToken)

        binding.grantButton.setOnClickListener { askForSmsPermission() }

        binding.saveButton.setOnClickListener {
            prefs.baseUrl = binding.baseUrlInput.text.toString()
            prefs.deviceId = binding.deviceIdInput.text.toString()
            prefs.deviceToken = binding.deviceTokenInput.text.toString()
            Toast.makeText(this, getString(R.string.saved), Toast.LENGTH_SHORT).show()
            updateStatus(hasSmsPermission())
        }

        binding.testButton.setOnClickListener { sendTestMessage() }
        binding.historyButton.setOnClickListener {
            startActivity(android.content.Intent(this, SyncHistoryActivity::class.java))
        }

        // Ask on first open, exactly once per launch if not yet granted.
        if (!hasSmsPermission()) askForSmsPermission()
        updateStatus(hasSmsPermission())
    }

    private fun hasSmsPermission(): Boolean =
        ContextCompat.checkSelfPermission(this, Manifest.permission.RECEIVE_SMS) ==
            PackageManager.PERMISSION_GRANTED &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.READ_SMS) ==
            PackageManager.PERMISSION_GRANTED

    private fun askForSmsPermission() {
        requestPermissions.launch(
            arrayOf(Manifest.permission.RECEIVE_SMS, Manifest.permission.READ_SMS)
        )
    }

    private fun updateStatus(permissionGranted: Boolean) {
        binding.statusText.text = when {
            !permissionGranted -> getString(R.string.status_no_permission)
            !prefs.isPaired -> getString(R.string.status_not_paired)
            else -> getString(R.string.status_ready)
        }
    }

    private fun sendTestMessage() {
        if (!prefs.isPaired) {
            Toast.makeText(this, getString(R.string.status_not_paired), Toast.LENGTH_LONG).show()
            return
        }
        val sample = "QWE1234567 Confirmed. Ksh500.00 paid to NAIVAS LTD. on 1/1/26 at 1:00 PM. " +
            "New M-PESA balance is Ksh1,000.00."
        lifecycleScope.launch {
            val ok = withContext(Dispatchers.IO) {
                SmsUploader.send(applicationContext, "MPESA", sample, System.currentTimeMillis())
            } !is SmsUploader.Outcome.Failed
            Toast.makeText(
                this@MainActivity,
                if (ok) getString(R.string.test_sent) else getString(R.string.test_failed),
                Toast.LENGTH_LONG
            ).show()
        }
    }
}
