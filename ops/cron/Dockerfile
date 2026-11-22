# Image for the Render Cron Job.
#
# The Next.js app itself runs on Vercel; Render only holds the scheduler. Each
# scheduled run of this container POSTs to the app's CRON_SECRET-protected
# endpoint, which is exactly what an external cron service would do.
#
# TARGET_URL and CRON_SECRET are provided by Render as environment variables.
FROM alpine:3.20

RUN apk add --no-cache curl

CMD ["sh", "-c", "curl --fail --silent --show-error --request POST --header \"Authorization: Bearer ${CRON_SECRET}\" --max-time 60 \"${TARGET_URL}/api/cron/run-checks\""]
