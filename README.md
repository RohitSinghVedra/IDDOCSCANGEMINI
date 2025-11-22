# IDDocScan - Indian Document Scanner

> **Note:** Requires OCR.space API key for optimal accuracy. Add `REACT_APP_OCR_SPACE_API_KEY` to Netlify environment variables.

A mobile-focused web application for scanning and extracting information from Indian ID documents including Aadhaar, Passport, PAN, Driving License, and more.

## Features

- 🔐 Google Sign-In Authentication
- 📷 Camera and File Upload Support
- 🤖 Automatic Document Type Recognition (Aadhaar, Passport, PAN, etc.)
- 🌐 Multi-language OCR Support (English, Hindi, and other Indian languages)
- 📋 Structured Data Extraction
- 📊 Auto-Save to Google Sheets
- 📱 Mobile-Responsive Design
- 🕒 Automatic Timestamp Recording

## Supported Documents

- 🆔 Aadhaar Card
- 📕 Passport
- 💳 PAN Card
- 🚗 Driving License
- 🗳️ Voter ID
- 📄 Other Documents

## Tech Stack

### Frontend
- React 18
- React Router
- Axios
- React Toastify

### Backend
- Node.js
- Express
- MongoDB
- JWT Authentication
- Multer (File Upload)
- Tesseract.js (OCR)
- Sharp (Image Processing)
- Google APIs

## Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd IDDocScan
```

2. **Install all dependencies**
```bash
npm run install-all
```

3. **Set up environment variables**

Create a `.env` file in the `server` directory:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/iddocscan
JWT_SECRET=your_jwt_secret_here
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:5000/api/google/oauth/callback
GOOGLE_ACCESS_TOKEN=your_google_access_token_here
GOOGLE_REFRESH_TOKEN=your_google_refresh_token_here
GOOGLE_SPREADSHEET_ID=your_google_spreadsheet_id_here
```

4. **Set up MongoDB**
Make sure MongoDB is installed and running on your system.

5. **Set up Google OAuth**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable Google Sheets API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI
6. Copy Client ID and Client Secret to `.env`

6. **Create a Google Sheet**
Create a Google Sheet and copy its ID (from the URL) to `GOOGLE_SPREADSHEET_ID` in `.env`

## Running the Application

Start both frontend and backend:
```bash
npm run dev
```

Or run them separately:

Backend:
```bash
cd server
npm run dev
```

Frontend:
```bash
cd client
npm start
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend: http://localhost:5000

## Usage

1. **Sign In**: Click "Continue with Google" to sign in
2. **Google Sheet Created**: Your personal sheet is automatically created
3. **Scan Document**: 
   - Choose between camera or file upload
   - Point camera at document or select file
   - Click "Scan Document" to process
4. **View in Sheets**: Click "Open Google Sheet" to view all your scanned documents
5. **Automatic Saving**: All scanned documents are automatically saved with timestamps

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Documents
- `POST /api/documents/process` - Process and scan document
- `GET /api/documents` - Get all documents
- `GET /api/documents/:id` - Get specific document

### Google Integration
- `GET /api/google/oauth/url` - Get OAuth URL
- `GET /api/google/oauth/callback` - OAuth callback
- `POST /api/google/connect` - Connect Google account
- `GET /api/google/status` - Check connection status
- `POST /api/google/sheets/save` - Save to Google Sheets

## Project Structure

```
IDDocScan/
├── client/                 # React frontend
│   ├── public/
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── App.js
│   │   └── index.js
│   └── package.json
├── server/                # Node.js backend
│   ├── models/           # MongoDB models
│   ├── routes/           # API routes
│   ├── middleware/       # Auth middleware
│   ├── index.js
│   └── package.json
└── package.json
```

## Security Notes

- Never commit `.env` files
- Use strong JWT secrets in production
- Implement rate limiting for production
- Validate and sanitize all inputs
- Use HTTPS in production

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

ISC

## Support

For issues and questions, please open an issue on GitHub.
