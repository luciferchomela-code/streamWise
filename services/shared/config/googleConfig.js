import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();

export const getOAuth2Client = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackUrl =
    process.env.GOOGLE_CALLBACK_URL ||
    "postmessage";

  if (!clientId || !clientSecret) {
    throw new Error(
      "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET."
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, callbackUrl);
};

export const oauth2client = getOAuth2Client();
