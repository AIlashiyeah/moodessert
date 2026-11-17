# Telegram Mini App setup

The same site runs as a Telegram Mini App. Opened on the plain web it behaves exactly as before; the code below only wakes up inside Telegram.

## What changes inside Telegram

- The dessert, the reveal animation, the "why this dessert" line and the pairing stay free. Those are the parts people share.
- The personal reading ("what drives you", "your contradiction", the personal line) is locked until the reader either watches a rewarded ad or pays in Telegram Stars.
- An ad opens the reading on the current card. One Stars payment opens every reading for the rest of that session.
- Share hands the link to Telegram's chat picker. The link reopens the Mini App with the same friend and pair codes the web links use.
- If neither payment nor ads are configured, nothing is locked.

## One-time setup

1. **Create the bot.** In Telegram, message @BotFather: `/newbot`, pick a name and a username. BotFather replies with the bot token. Treat it like a password.
2. **Set environment variables** on the host (Vercel: Project → Settings → Environment Variables), then redeploy.

   | Name | Required | Value |
   |---|---|---|
   | `TELEGRAM_BOT_TOKEN` | yes | the token from BotFather |
   | `TELEGRAM_WEBHOOK_SECRET` | yes | any long random string you make up (letters, digits, `_`, `-`) |
   | `TG_APP_LINK` | for sharing | `https://t.me/<your_bot_username>` |
   | `UNLOCK_STARS` | no | price of one unlock in Stars, default `50` |
   | `ADSGRAM_BLOCK_ID` | no | rewarded block id from AdsGram; empty hides the ad button |
   | `TG_WEBAPP_URL` | no | the site's public URL, if it differs from the host the request arrives on |

3. **Point the bot at the site.** Run once, with your own site and webhook secret (not the bot token):

   ```
   curl -X POST https://<your-site>/api/tg -H "Content-Type: application/json" -d '{"op":"setup","secret":"<TELEGRAM_WEBHOOK_SECRET>"}'
   ```

   It sets the webhook, the bot's menu button and the command list, and answers with what succeeded.
4. **Turn on the Mini App link.** In @BotFather: `/mybots` → your bot → Bot Settings → Configure Mini App → enable it and enter the site URL. After that `https://t.me/<your_bot_username>?startapp=...` opens the app directly, which is what the share button sends.
5. **Ads (optional).** Register the Mini App at AdsGram, create a Reward block, put its id in `ADSGRAM_BLOCK_ID`, redeploy.

## Good to know

- Stars are the only currency Telegram allows for digital goods inside Mini Apps; no payment provider is needed.
- Refunds: each payment logs `stars paid <user id> <amount> <charge id>` in the function log. Refund with the Bot API method `refundStarPayment` (`user_id`, `telegram_payment_charge_id`). The bot answers `/paysupport` and `/terms`.
- The lock is enforced in the page. The reading is generated before the choice is shown, so a technical user could dig it out of the network response. That is acceptable for a first version; moving the reading behind the payment on the server is the next step if it matters.
- `GET /api/tg` returns only public values (app link, price, whether payment is on, ad block id). The token and the webhook secret never leave the server.
