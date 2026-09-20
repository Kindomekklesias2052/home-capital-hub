package app.kinshipcapital.companion

import android.content.Context

/** Stores the pairing details shown on the Devices page of Kinship Capital. */
class Prefs(context: Context) {
    private val sp = context.getSharedPreferences("kinship", Context.MODE_PRIVATE)

    var baseUrl: String
        get() = sp.getString("base_url", DEFAULT_BASE_URL) ?: DEFAULT_BASE_URL
        set(value) = sp.edit().putString("base_url", value.trimEnd('/')).apply()

    var deviceId: String
        get() = sp.getString("device_id", "") ?: ""
        set(value) = sp.edit().putString("device_id", value.trim()).apply()

    var deviceToken: String
        get() = sp.getString("device_token", "") ?: ""
        set(value) = sp.edit().putString("device_token", value.trim()).apply()

    val isPaired: Boolean
        get() = deviceId.isNotBlank() && deviceToken.isNotBlank()

    companion object {
        const val DEFAULT_BASE_URL = "https://home-capital-hub.lovable.app"
    }
}
