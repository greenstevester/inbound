/**
 * Simulates an inbound email for local development testing
 * Run with: bun run scripts/simulate-inbound-email.ts
 */

const SERVICE_API_KEY = process.env.SERVICE_API_KEY || "dev-service-key-inbound-local-12345";
const INBOUND_BASE_URL = process.env.INBOUND_BASE_URL || "http://localhost:3000";

interface SimulatedEmailOptions {
  from: string;
  to: string;
  subject: string;
  textBody: string;
  htmlBody?: string;
}

async function simulateInboundEmail(options: SimulatedEmailOptions) {
  const messageId = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const timestamp = new Date().toISOString();

  // Build raw email content (simplified RFC 822 format)
  const rawEmail = [
    `From: ${options.from}`,
    `To: ${options.to}`,
    `Subject: ${options.subject}`,
    `Message-ID: <${messageId}@test.local>`,
    `Date: ${new Date().toUTCString()}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset="UTF-8"`,
    ``,
    options.textBody,
  ].join("\r\n");

  // Create SES-like webhook payload
  const payload = {
    type: "ses_event_with_content",
    timestamp: timestamp,
    originalEvent: {
      Records: [
        {
          eventSource: "aws:ses",
          eventVersion: "1.0",
          ses: {
            mail: {
              timestamp: timestamp,
              source: options.from,
              messageId: messageId,
              destination: [options.to],
              headersTruncated: false,
              headers: [
                { name: "From", value: options.from },
                { name: "To", value: options.to },
                { name: "Subject", value: options.subject },
                { name: "Message-ID", value: `<${messageId}@test.local>` },
                { name: "Date", value: new Date().toUTCString() },
              ],
              commonHeaders: {
                returnPath: options.from,
                from: [options.from],
                to: [options.to],
                subject: options.subject,
                messageId: `<${messageId}@test.local>`,
              },
            },
            receipt: {
              timestamp: timestamp,
              processingTimeMillis: 100,
              recipients: [options.to],
              spamVerdict: { status: "PASS" },
              virusVerdict: { status: "PASS" },
              spfVerdict: { status: "PASS" },
              dkimVerdict: { status: "PASS" },
              dmarcVerdict: { status: "PASS" },
              action: {
                type: "Lambda",
                functionArn: "arn:aws:lambda:us-east-1:123456789012:function:test",
              },
            },
          },
        },
      ],
    },
    processedRecords: [
      {
        eventSource: "aws:ses",
        eventVersion: "1.0",
        ses: {
          mail: {
            timestamp: timestamp,
            source: options.from,
            messageId: messageId,
            destination: [options.to],
            headersTruncated: false,
            headers: [
              { name: "From", value: options.from },
              { name: "To", value: options.to },
              { name: "Subject", value: options.subject },
              { name: "Message-ID", value: `<${messageId}@test.local>` },
              { name: "Date", value: new Date().toUTCString() },
            ],
            commonHeaders: {
              returnPath: options.from,
              from: [options.from],
              to: [options.to],
              subject: options.subject,
              messageId: `<${messageId}@test.local>`,
            },
          },
          receipt: {
            timestamp: timestamp,
            processingTimeMillis: 100,
            recipients: [options.to],
            spamVerdict: { status: "PASS" },
            virusVerdict: { status: "PASS" },
            spfVerdict: { status: "PASS" },
            dkimVerdict: { status: "PASS" },
            dmarcVerdict: { status: "PASS" },
            action: {
              type: "Lambda",
              functionArn: "arn:aws:lambda:us-east-1:123456789012:function:test",
            },
          },
        },
        emailContent: rawEmail,
        s3Location: {
          bucket: "test-bucket",
          key: `emails/${messageId}`,
          contentFetched: true,
          contentSize: rawEmail.length,
        },
      },
    ],
    context: {
      functionName: "simulate-inbound-email",
      functionVersion: "$LATEST",
      requestId: `req-${messageId}`,
    },
  };

  console.log("📧 Simulating inbound email...");
  console.log(`   From: ${options.from}`);
  console.log(`   To: ${options.to}`);
  console.log(`   Subject: ${options.subject}`);
  console.log(`   Message ID: ${messageId}`);
  console.log("");

  try {
    const response = await fetch(`${INBOUND_BASE_URL}/api/inbound/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (response.ok && result.success) {
      console.log("✅ Email simulated successfully!");
      console.log(`   Processed: ${result.processedEmails} email(s)`);
      if (result.emails?.[0]?.emailId) {
        console.log(`   Email ID: ${result.emails[0].emailId}`);
      }
    } else {
      console.log("❌ Email simulation failed:");
      console.log(JSON.stringify(result, null, 2));
    }

    return result;
  } catch (error) {
    console.error("❌ Error simulating email:", error);
    throw error;
  }
}

// Run the simulation with a test email
simulateInboundEmail({
  from: "petowner@example.com",
  to: "support@thepetpanicbutton.com",
  subject: "Help! My dog ate chocolate!",
  textBody: `Hi,

My golden retriever Max just ate about 3 pieces of dark chocolate from a box I left on the counter. He weighs about 65 pounds. He seems fine right now but I'm really worried.

What should I do? Is this an emergency?

Thanks,
Worried Pet Owner`,
})
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
