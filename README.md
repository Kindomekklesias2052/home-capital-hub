# Family Ledger

Build a production-ready personal and household financial management application called "Kinship Capital".

The application should be designed around the concept of treating the household as an integrated financial institution.

CORE PURPOSE

The application should automatically organize a user's financial transactions into separate:

1. Business Ledger

2. Personal Ledger

3. Family Ledger

The system should eventually support automatic transaction ingestion from Android SMS messages from services such as M-PESA and Kenyan banks.

IMPORTANT:

Build the application architecture so that an Android native SMS ingestion module can later send parsed transactions into the backend through a secure API.

TECH STACK

Frontend:

- React

- TypeScript

- Tailwind CSS

- Responsive mobile-first UI

- PWA support

Backend:

- Supabase

- PostgreSQL

- Supabase Authentication

- Supabase Row Level Security

- Supabase Edge Functions where appropriate

DESIGN

Create a clean, modern financial application.

Mobile-first because the primary users will access the application from phones.

Use:

- Bottom navigation on mobile

- Dashboard cards

- Transaction lists

- Charts

- Category badges

- Clean financial typography

- Accessible buttons

- Dark/light mode

AUTHENTICATION

Implement:

- Email/password registration

- Login

- Logout

- Password reset

- User profile

DATABASE

Create these tables:

profiles

- id

- full_name

- phone_number

- created_at

transactions

- id

- user_id

- transaction_type

- amount

- currency

- description

- merchant

- sender

- recipient

- reference

- source

- scope

- category_id

- transaction_date

- confidence_score

- is_manual

- created_at

transaction_categories

- id

- user_id

- name

- scope

- is_custom

- created_at

budgets

- id

- user_id

- category_id

- amount

- period

- start_date

- end_date

- created_at

paired_devices

- id

- user_id

- device_name

- device_token

- device_type

- paired_at

- status

financial_metrics

- id

- user_id

- firewall_index

- latency_speed

- consensus_ratio

- calculated_at

SUPPORTED TRANSACTION TYPES

Create:

- income

- expense

- transfer

- loan

- withdrawal

- deposit

SOURCES

Support:

- M-PESA

- KCB

- Equity

- Bank

- Cash

- Manual

SCOPES

Support:

- Business

- Personal

- Family

DEFAULT CATEGORIES

Business:

- Business Revenue

- Stock

- Supplies

- Transport

- Salaries

- Rent

- Utilities

- Marketing

- Loan Repayment

- Other Business

Personal:

- Food

- Transport

- Clothing

- Entertainment

- Personal Bills

- Savings

- Other Personal

Family:

- School Fees

- Household Food

- Rent

- Utilities

- Healthcare

- Family Transport

- Family Support

- Other Family

DASHBOARD

Create a dashboard showing:

- Total income

- Total expenses

- Net cash flow

- Business balance

- Personal balance

- Family balance

Also show:

- Recent transactions

- Spending by category

- Income vs expenses chart

- Monthly cash flow

- Business vs Personal vs Family comparison

TRANSACTIONS PAGE

Create:

- Search

- Filter by date

- Filter by source

- Filter by transaction type

- Filter by scope

- Filter by category

Allow:

- Add transaction

- Edit transaction

- Delete transaction

- Change category

- Change scope

AUTOMATIC SMS TRANSACTION API

Create a secure API endpoint:

POST /api/transactions/sms

Expected JSON:

{

  "sms_body": "raw SMS text",

  "sender": "MPESA",

  "received_at": "2026-09-14T12:00:00Z",

  "device_id": "device-id"

}

The backend should:

1. Authenticate the device/user.

2. Store the original SMS securely.

3. Parse the transaction.

4. Extract amount.

5. Extract transaction type.

6. Extract sender/recipient.

7. Extract transaction reference.

8. Extract date/time.

9. Determine source.

10. Assign a category.

11. Assign Business, Personal or Family scope.

12. Store confidence_score.

13. Return the parsed transaction.

Create a parsing service that can initially recognize common Kenyan M-PESA transaction patterns.

Do NOT hard-code one exact SMS format. Create a parser architecture that supports multiple patterns and can be expanded later for KCB, Equity and other banks.

MANUAL CORRECTION

If automatic categorization has low confidence, display:

"Please confirm this transaction"

Allow the user to select:

- Transaction type

- Category

- Scope

Use the correction to improve future categorization.

FINANCIAL METRICS

Create calculations for:

FIREWALL INDEX:

Percentage of domestic/family expenses funded from the designated salary/personal pool.

LATENCY SPEED:

Average time taken by the user to reconcile and classify incoming transactions.

CONSENSUS RATIO:

Percentage of transactions requiring dual-user/spousal confirmation that were agreed upon.

Display these metrics in an analytics section.

MULTI-DEVICE

Create a device pairing interface.

Users should be able to:

- Generate pairing code

- Pair another device

- View paired devices

- Remove paired device

Build the database/API architecture so push notifications can later be implemented with Firebase Cloud Messaging.

SECURITY

Implement:

- Supabase Row Level Security

- Users can only access their own transactions

- Secure API authentication

- Do not expose service-role keys in frontend code

- Validate all transaction amounts

- Validate transaction ownership

- Protect device pairing endpoints

IMPORTANT UI

Create the following pages:

/login

/register

/dashboard

/transactions

/add-transaction

/budgets

/analytics

/categories

/devices

/profile

/settings

Make the application fully responsive.

Create realistic demo transactions so the interface is immediately testable.

Do not create fake SMS permissions or pretend that a web browser can read Android SMS.

Instead, clearly structure the application so a separate Android native SMS receiver can POST parsed SMS transactions to the backend.

Generate clean, maintainable TypeScript code with reusable components and clear folder organization.

The application should be ready for future Android packaging and Play Store deployment.
class SmsReceiver : BroadcastReceiver() {

    override fun onReceive(

        context: Context,

        intent: Intent

    ) {

        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) {

            return

        }

        val messages =

            Telephony.Sms.Intents.getMessagesFromIntent(intent)

        for (message in messages) {

            val sender = message.originatingAddress

            val body = message.messageBody

            if (sender != null) {

                if (

                    sender.contains("MPESA", ignoreCase = true) ||

                    sender.contains("KCB", ignoreCase = true) ||

                    sender.contains("EQUITY", ignoreCase = true)

                ) {

                    // Send SMS to transaction parser

                    sendToBackend(

                        sender = sender,

                        message = body

                    )

                }

            }

        }

    }

    private fun sendToBackend(

        sender: String,

        message: String

    ) {

        // HTTPS request to your backend

        // POST /api/transactions/sms

    }

}

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://home-capital-hub.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c8e894ba-5cc6-47a0-a178-ec623ec808a2).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
