# Nightclub ID Scanning System - Admin Guide

## Overview

This system is designed for **nightclubs in India** where government regulations require scanning IDs of all visitors. The system is centrally managed by administrators who create accounts for each nightclub.

## System Architecture

### User Types

1. **Admin Users**: 
   - Login via Google Sign-In
   - Access admin dashboard at `/admin`
   - Create and manage nightclub accounts
   - Currently identified by email containing "admin"

2. **Nightclub Users**:
   - Login via username/password at `/club-login`
   - Each nightclub gets:
     - **App Username/Password**: For accessing the scanning application
     - **Gmail Account**: Pre-configured Gmail for Google Sheets storage
   - All scanned IDs automatically saved to their Google Sheet
   - No manual Google connection needed

## Setup Instructions

### 1. Admin Access

1. Sign in with a Google account (email should contain "admin")
2. You'll be automatically redirected to `/admin` dashboard
3. Or manually navigate to `/admin` after login

### 2. Creating a Nightclub Account

**Step 1: Create Gmail Account Manually**
1. Go to Gmail and create a new account (e.g., `mumbainightclub@gmail.com`)
2. Note down the email and password
3. This Gmail will be used for the nightclub's Google Sheets

**Step 2: Add Nightclub in Admin Dashboard**
1. Go to Admin Dashboard
2. Click "Add New Nightclub"
3. Fill in the form:
   - **Nightclub Name**: Display name (e.g., "Mumbai Nightclub")
   - **Username**: Login username for app (e.g., "mumbai_nightclub")
   - **Password**: Login password for app (give this to club owner)
   - **Gmail Account**: The Gmail email you created (e.g., "mumbainightclub@gmail.com")
   - **Gmail Password**: The Gmail password (stored securely in system)

4. Click "Add Nightclub"

**Step 3: Provide Credentials to Club Owner**
- Give them:
  - **App Username**: The username you created
  - **App Password**: The password you created
  - **Gmail Account**: The Gmail email (optional, for their reference)
  - **Gmail Password**: The Gmail password (so they can access their sheet if needed)

### 3. Nightclub User Login

1. Club owner goes to `/club-login`
2. Enters username and password provided by admin
3. System automatically connects to their Gmail account
4. All scanned IDs are saved to their Google Sheet
5. No need to connect Google account manually

## Important Notes

### Google Sheets API Authentication

⚠️ **Important**: Google Sheets API requires OAuth tokens, not passwords. The Gmail password stored is for:
- Admin reference
- Club owner access to Gmail/Sheets manually
- Future token generation (if implemented)

**Current Limitation**: The system stores Gmail credentials, but for automatic Google Sheets access, you'll need to:

**Option 1: Use Google Service Account (Recommended)**
- Create a Google Service Account
- Share nightclub spreadsheets with service account email
- Use service account credentials for API access
- More secure and doesn't require OAuth tokens

**Option 2: Generate OAuth Tokens Manually**
- Use Google OAuth 2.0 Playground
- Generate access token and refresh token for each Gmail account
- Store tokens in Firestore (can add this field later)

**Option 3: Implement Token Generation (Future)**
- Build backend service to generate OAuth tokens using stored credentials
- Requires Google OAuth flow implementation

### For Now

The system is set up to store credentials centrally. For Google Sheets to work automatically, you'll need to implement one of the options above. The club owner can still manually access their Google Sheet using the Gmail credentials you provide.

## Firestore Structure

### Clubs Collection

```
clubs/
  {clubId}/
    - id: string
    - name: string (Nightclub name)
    - username: string (unique, lowercase, for app login)
    - passwordHash: string (SHA-256 hashed app password)
    - gmail: string (Gmail account email)
    - gmailPasswordHash: string (SHA-256 hashed Gmail password)
    - spreadsheetId: string (auto-created when first used)
    - spreadsheetUrl: string (auto-created when first used)
    - isActive: boolean
    - createdAt: timestamp
    - updatedAt: timestamp
    - createdBy: string (admin user ID)
```

## Features

### Admin Dashboard
- View all nightclubs in a table
- Add new nightclubs with Gmail credentials
- Edit existing nightclubs (update passwords, Gmail)
- Delete nightclubs
- View spreadsheet links
- See nightclub status (Active/Inactive)

### Nightclub Dashboard
- Automatically uses nightclub's Gmail account
- Shows nightclub name and Gmail being used
- All scanned IDs saved to nightclub's spreadsheet
- Simple interface for scanning visitor IDs

## Security Considerations

1. **Password Storage**: Passwords are hashed using SHA-256 (should upgrade to bcrypt in production)
2. **Gmail Credentials**: Stored hashed in Firestore (consider additional encryption in production)
3. **Admin Access**: Currently based on email pattern (should use Firestore roles in production)
4. **Google API Access**: Need to implement proper OAuth or Service Account for automatic Sheets access

## Workflow

1. **Admin creates Gmail account** → Stores credentials
2. **Admin adds nightclub** → Enters Gmail credentials in system
3. **Admin gives credentials to club owner** → Username/password for app + Gmail credentials
4. **Club owner logs in** → Uses app to scan visitor IDs
5. **IDs automatically saved** → To nightclub's Google Sheet (once OAuth/Service Account is configured)

## Troubleshooting

### Nightclub can't save scanned IDs
- Check if Gmail account is properly configured
- Verify Google Sheets API access (may need OAuth tokens or Service Account)
- Ensure nightclub account is active

### Admin can't access dashboard
- Ensure email contains "admin" or userType is "admin"
- Check Firebase authentication

### Spreadsheet not created
- Verify Gmail credentials are correct
- Check Google API permissions
- May need to implement OAuth token generation or Service Account

## Next Steps for Production

1. **Implement Google Service Account** (Recommended)
   - Create service account in Google Cloud Console
   - Share nightclub spreadsheets with service account
   - Use service account credentials for API calls

2. **Add OAuth Token Management**
   - Generate tokens for each Gmail account
   - Store refresh tokens securely
   - Implement automatic token refresh

3. **Enhance Security**
   - Use bcrypt for password hashing
   - Encrypt Gmail passwords in Firestore
   - Implement proper admin role management

4. **Add Features**
   - Nightclub analytics and reports
   - Bulk operations for multiple nightclubs
   - Audit logs for compliance
