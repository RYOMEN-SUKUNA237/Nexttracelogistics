const { sendMail } = require('./server/utils/mailer');
require('dotenv').config({ path: '.env.local' });

async function testEmail() {
  console.log("Testing email with user:", process.env.SMTP_USER);
  const result = await sendMail({
    to: 'nexttracelogistics@gmail.com', // sending to itself just to test
    subject: 'Test Email Configuration',
    html: '<h1>Success!</h1><p>The new app password is working perfectly.</p>',
    text: 'Success! The new app password is working perfectly.'
  });
  console.log(result);
}

testEmail().catch(console.error);
