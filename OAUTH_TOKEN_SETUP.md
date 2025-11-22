# How to Generate OAuth Tokens for Nightclub Gmail Accounts

## Problem
When trying to generate OAuth tokens using the "Generate Tokens" button, you may see an error:
**"Access blocked: docidscan.netlify.app has not completed the Google verification process"**

This happens because the nightclub's Gmail account is not in the list of test users.

## Solution: Use Google OAuth Playground (Recommended)

This is the easiest and most reliable method:

### Step 1: Go to Google OAuth Playground
1. Visit: https://developers.google.com/oauthplayground/
2. Click the **⚙️ Settings** icon (top right)
3. Check **"Use your own OAuth credentials"**
4. Enter:
   - **OAuth Client ID**: Your `REACT_APP_GOOGLE_CLIENT_ID`
   - **OAuth Client secret**: Your `REACT_APP_GOOGLE_CLIENT_SECRET`
5. Click **Close**

### Step 2: Select Scopes
1. In the left panel, scroll down to **"Google Sheets API v4"**
2. Check: `https://www.googleapis.com/auth/spreadsheets`
3. Click **"Authorize APIs"** button

### Step 3: Sign In
1. Sign in with the **nightclub's Gmail account** (e.g., `vclubclub432@gmail.com`)
2. Click **"Allow"** to grant permissions
3. You'll be redirected back to OAuth Playground

### Step 4: Exchange for Tokens
1. Click **"Exchange authorization code for tokens"** button
2. You'll see:
   - **Access token**: `ya29.a0AfH6SMC...` (copy this)
   - **Refresh token**: `1//0g...` (copy this)

### Step 5: Add Tokens to Admin Dashboard
1. Go to Admin Dashboard
2. Click **"Edit"** on the nightclub
3. Paste the **Access Token** in the "Access Token" field
4. Paste the **Refresh Token** in the "Refresh Token" field
5. Click **"Update Nightclub"**

## Alternative: Add Test Users (For "Generate Tokens" Button)

If you want to use the "Generate Tokens" button in the admin dashboard:

### Step 1: Go to Google Cloud Console
1. Visit: https://console.cloud.google.com/
2. Select your project
3. Go to **APIs & Services** → **OAuth consent screen**

### Step 2: Add Test Users
1. Scroll down to **"Test users"** section
2. Click **"+ ADD USERS"**
3. Add each nightclub's Gmail address:
   - `vclubclub432@gmail.com`
   - `jb432@gmail.com`
   - (Add all nightclub Gmail accounts)
4. Click **"ADD"**

### Step 3: Use Generate Tokens Button
1. Go to Admin Dashboard
2. Click **"Generate Tokens"** button for the nightclub
3. Sign in with the nightclub's Gmail account
4. Tokens will be saved automatically

## Important Notes

- **Access tokens expire** (usually after 1 hour)
- **Refresh tokens** are long-lived and can generate new access tokens
- Always store **both tokens** for automatic renewal
- For production, consider using a **Google Service Account** instead

## Troubleshooting

### "Access blocked" error
- Make sure the Gmail account is added as a test user
- Or use OAuth Playground method (doesn't require test users)

### Tokens not working
- Check if tokens are expired (access tokens expire quickly)
- Regenerate using refresh token or OAuth Playground
- Verify the Gmail account has proper permissions

### Can't find refresh token
- OAuth Playground always provides refresh tokens
- The "Generate Tokens" button may not provide refresh tokens
- Use OAuth Playground for refresh tokens

