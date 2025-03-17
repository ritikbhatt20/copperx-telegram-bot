# Copperx Payout Telegram Bot

Welcome to the Copperx Payout Telegram Bot, a TypeScript-based Telegram bot that integrates with the Copperx Payout API to enable users to manage their stablecoin transactions directly from Telegram. This bot allows depositing, withdrawing, and transferring USDC without needing to visit the Copperx web app.

This project was built for the Copperx Telegram Bot Bounty by [Your Name/Handle]. Try it out at @CopperxPayoutBot (replace with your actual bot username after deployment)!

## Features

- **Authentication**: Secure login with email OTP.
- **Wallet Management**: View balances, set default wallets, and deposit funds.
- **Fund Transfers**: Send USDC via email or wallet address, withdraw to bank accounts, and view transaction history.
- **Real-Time Notifications**: Receive deposit notifications via Pusher.
- **Interactive UI**: Intuitive commands, inline keyboards, and natural language support (e.g., "send 5 USDC to user@example.com").
- **Security**: Session management with Redis, no plaintext passwords, and transaction confirmations.

## Setup Instructions

### Prerequisites

- **Node.js**: v16.x or later
- **npm**: v8.x or later
- **Redis**: v6.x or later (for session management)
- **Telegram Account**: To create and manage your bot
- **Copperx Account**: For API access
- **Pusher Account**: For real-time notifications

### Installation

#### Clone the Repository

```bash
git clone https://github.com/your-username/copperx-telegram-bot.git
cd copperx-telegram-bot
```

#### Install Dependencies

```bash
npm install
```

#### Set Up Environment Variables

Create a `.env` file in the root directory and add the following:

```env
BOT_TOKEN=your-telegram-bot-token          # From BotFather on Telegram
REDIS_HOST=localhost                       # Redis host (default: localhost)
REDIS_PORT=6379                            # Redis port (default: 6379)
REDIS_PASSWORD=your-redis-password         # Optional: Redis password
PUSHER_APP_KEY=e089376087cac1a62785       # From Pusher dashboard
PUSHER_APP_CLUSTER=ap1                     # Pusher cluster (e.g., ap1)
PUSHER_APP_SECRET=your-pusher-secret       # From Pusher dashboard
NODE_ENV=development                       # Set to 'production' for prod
```

- Get BOT_TOKEN from BotFather.
- Configure Redis (e.g., via Docker: `docker run -d -p 6379:6379 redis`).
- Obtain Pusher credentials from Pusher.

#### Build the Project

```bash
npm run build
```

#### Run the Bot Locally

```bash
npm start
```

### Deploy the Bot (Optional)

Deploy on a free service like Render:

1. Push your repository to GitHub.
2. Create a new Web Service on Render, link your repo, and set the build command to `npm install && npm run build` and start command to `npm start`.
3. Add the `.env` variables in Render's Environment section.
4. After deployment, update BotFather with your webhook URL (e.g., `https://your-app.onrender.com/bot<your-token>`), though this bot uses polling by default.

### Test the Bot

Start a chat with @YourBotUsername on Telegram and run `/start`.

## API Integration Details

The bot integrates with the Copperx Payout API (base URL: `https://income-api.copperx.io`). Full documentation is available at Copperx API Docs. Key endpoints used:

### Authentication:
- `/api/auth/email-otp/request`: Request OTP for login.
- `/api/auth/email-otp/authenticate`: Authenticate with OTP.
- `/api/auth/me`: Fetch user profile.

### KYC:
- `/api/kycs`: Check KYC/KYB status.

### Wallets:
- `/api/wallets`: List wallets.
- `/api/wallets/balances`: Get wallet balances.
- `/api/wallets/default`: Set default wallet.

### Transfers:
- `/api/transfers/send`: Send USDC to an email.
- `/api/transfers/wallet-withdraw`: Send USDC to a wallet.
- `/api/transfers/offramp`: Withdraw to a bank.
- `/api/transfers/send-batch`: Batch transfers.
- `/api/transfers?page=1&limit=10`: Transaction history.

### Payees:
- `/api/payees`: Add/list payees.
- `/api/payees/{id}`: Delete payee.

### Quotes:
- `/api/quotes/offramp`: Get bank withdrawal quote.

### Notifications:
- `/api/notifications/auth`: Authenticate Pusher.
- Pusher channel: `private-org-${organizationId}` for deposit events.

All API calls use Axios with TypeScript types defined in `config.ts`. Authentication tokens are passed via `Authorization: Bearer` headers.

## Command Reference

Below is a list of available commands and their descriptions:

| Command | Description | Example Usage |
|---------|-------------|---------------|
| `/start` | Start or restart the bot | `/start` |
| `/help` | Show available commands | `/help` |
| `/profile` | View your Copperx profile | `/profile` |
| `/kyc` | Check KYC/KYB status | `/kyc` |
| `/balance` | View wallet balances | `/balance` |
| `/setdefault` | Set default wallet | `/setdefault` |
| `/deposit` | Get deposit instructions | `/deposit` |
| `/send` | Send USDC to a wallet address | `/send` |
| `/sendemail` | Send USDC via email | `/sendemail` |
| `/sendbatch` | Send USDC to multiple payees | `/sendbatch` |
| `/withdraw` | Withdraw USDC to a bank account | `/withdraw` |
| `/history` | View last 10 transactions | `/history` |
| `/addpayee` | Add a new payee | `/addpayee` |
| `/removepayee` | Remove an existing payee | `/removepayee` |
| `/points` | View your Copperx Mint points | `/points` |
| `/logout` | Log out of your account | `/logout` |

### Natural Language Support
- Send funds: `send 5 USDC to user@example.com` or `send 5 USDC to 0x123...abc`.
- Deposit: `deposit 5 USDC`.

### Inline Keyboard Options
Most commands trigger interactive menus (e.g., wallet selection, confirmation buttons). Follow the prompts to complete actions.

## Troubleshooting Guide

### Common Issues & Solutions

#### Bot Doesn't Respond
- **Cause**: Missing or invalid BOT_TOKEN.
- **Fix**: Verify your `.env` file and ensure the token from BotFather is correct. Restart with `npm start`.

#### "Session Expired" Error
- **Cause**: Token expired or invalid.
- **Fix**: Log in again with `/start` or `/login`. Check Redis connectivity.

#### "Rate Limit Exceeded"
- **Cause**: Too many API requests (e.g., OTP requests).
- **Fix**: Wait the specified time (e.g., 60 seconds) and retry. See error message for details.

#### Deposit Notifications Not Working
- **Cause**: Pusher misconfiguration or signature mismatch.
- **Fix**: 
  - Ensure PUSHER_APP_KEY, PUSHER_APP_CLUSTER, and PUSHER_APP_SECRET are correct in `.env`.
  - Check logs for Pusher errors. Note: A signature mismatch workaround is in place—contact Copperx support at Telegram Community to resolve.

#### Redis Connection Errors
- **Cause**: Redis server not running or misconfigured.
- **Fix**: Start Redis (`redis-server`) or update REDIS_HOST, REDIS_PORT, and REDIS_PASSWORD in `.env`.

#### API Errors (e.g., 401, 403)
- **Cause**: Invalid or expired access token.
- **Fix**: Re-authenticate via `/start`. Ensure your Copperx account is active.

#### "No Wallets Found"
- **Cause**: Account setup incomplete on Copperx.
- **Fix**: Visit Copperx Dashboard to add a wallet.

### Debugging Tips
- Set `NODE_ENV=development` in `.env` to enable console logging.
- Check `error.log` and `combined.log` for detailed error messages.
- Contact support at Copperx Telegram Community for API-related issues.

## Development Notes
- **Tech Stack**: TypeScript, Node.js, Telegraf, Redis, Axios, Pusher.
- **Security**: Sessions stored in Redis with 30-day TTL, no plaintext credentials.
- **Future Improvements**: Add unit tests, refactor long handlers, resolve Pusher signature issue.

## Contributing
Feel free to fork this repo and submit pull requests! Report issues via GitHub or the Copperx Telegram community.

## License
MIT License - see LICENSE for details.
