# Kinship Capital — Android companion app

Reads incoming M-PESA / KCB / Equity texts on the phone and forwards them to your
Kinship Capital account, where they are parsed into transactions.

## How it works

1. On first open the app asks for permission to receive and read SMS.
2. `SmsReceiver` (a `BroadcastReceiver` on `Telephony.Sms.Intents.SMS_RECEIVED_ACTION`)
   filters the sender for MPESA / M-PESA / KCB / EQUITY / SAFARICOM.
3. Matching messages are queued with WorkManager and POSTed to
   `POST {baseUrl}/api/public/transactions/sms` with
   `Authorization: Bearer <device_token>` and body
   `{ sms_body, sender, received_at, device_id }`.
   Offline phones retry automatically (up to 5 attempts).
4. The server parses, categorises and stores the transaction; low-confidence ones
   appear in the web app flagged "Please confirm this transaction".

## Pairing

In the web app open **Devices → Pair a device**. Copy the **Device ID** and
**Device token** into the app's setup screen, keep the web address as
`https://home-capital-hub.lovable.app`, then tap **Save pairing**.
Use **Send a test message** to confirm the connection.

## Building

Requires Android Studio (Koala or newer) / JDK 17.

```bash
cd android
./gradlew assembleDebug        # app/build/outputs/apk/debug/app-debug.apk
./gradlew assembleRelease      # sign before uploading to Play
```

Install the debug APK on the phone with `adb install app-debug.apk`.

## Play Store note

Google restricts the `READ_SMS` / `RECEIVE_SMS` permissions. For personal use,
install the APK directly (sideload). For a Play listing you must submit the
permissions declaration form describing the financial-SMS use case.
