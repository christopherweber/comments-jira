require('dotenv').config();
const serverless = require('serverless-http');
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

app.post('/webhook', async (req, res) => {
  console.log('Received webhook:', req.body);
  const data = req.body;
  const incident_id = data.data?.incident?.id;

  if (!incident_id) {
    return res.status(400).json({ "error": "Incident ID not found in payload" });
  }

  // Authorization for FireHydrant
  const firehydrant_token = process.env.FIREHYDRANT_TOKEN;
  const headers = { "Authorization": `Bearer ${firehydrant_token}` };
  const incident_details_url = `https://api.firehydrant.io/v1/incidents/${incident_id}`;

  try {
    const incidentResponse = await axios.get(incident_details_url, { headers });
    const incident_details = incidentResponse.data;
    const last_note_body = incident_details.data[0]?.last_note?.body;

    if (!last_note_body) {
      return res.status(400).json({ "error": "Last note body not found in incident details" });
    }

    // JIRA Authentication and Request
    const jira_email = process.env.JIRA_EMAIL;
    const jira_token = process.env.JIRA_TOKEN;
    const jira_url = "https://spaceshipco.atlassian.net/rest/api/3/issue/AC-75/comment";
    const jira_auth = Buffer.from(`${jira_email}:${jira_token}`).toString('base64');
    const jira_headers = { "Content-Type": "application/json", "Authorization": `Basic ${jira_auth}` };
    const jira_payload = {
      "body": {
        "version": 1,
        "type": "doc",
        "content": [
          {
            "type": "paragraph",
            "content": [
              {
                "text": last_note_body,
                "type": "text"
              }
            ]
          }
        ]
      }
    };

    const jiraResponse = await axios.post(jira_url, jira_payload, { headers: jira_headers });

    res.json({ "message": "Jira comment created successfully" });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      "error": "Failed to create Jira comment", 
      "details": error.response?.data || error.message 
    });
  }
});

module.exports.handler = serverless(app);

// const port = 3001; // Use any free port
// app.listen(port, () => {
//   console.log(`Server listening on http://localhost:${port}`);
// });