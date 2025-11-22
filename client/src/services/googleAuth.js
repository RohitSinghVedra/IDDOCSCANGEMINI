/**
 * Google OAuth and Sheets API Service
 * Handles Google authentication and Sheets operations directly from frontend
 * Uses Google Identity Services (GIS) for authentication and gapi.client for Sheets API
 */

import { gapi } from 'gapi-script';

let accessToken = null;
let gapiInitialized = false;
let clubAccessToken = null; // For club accounts using pre-configured Gmail

// Initialize Google API Client for Sheets API (no auth2)
export const initGoogleAPI = () => {
  return new Promise((resolve, reject) => {
    const API_KEY = process.env.REACT_APP_GOOGLE_API_KEY;
    
    if (gapiInitialized) {
      resolve(gapi);
      return;
    }

    // Initialize gapi.client without auth2 (we'll use OAuth 2.0 tokens)
    gapi.load('client', () => {
      gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4']
      }).then(() => {
        console.log('Google Sheets API initialized successfully');
        gapiInitialized = true;
        resolve(gapi);
      }).catch((error) => {
        console.error('Google API initialization error:', error);
        reject(error);
      });
    });
  });
};

// Sign in using OAuth 2.0 (Google Identity Services compatible)
export const signInGoogle = async () => {
  return new Promise((resolve, reject) => {
    const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
    
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.email',
      callback: async (tokenResponse) => {
        if (tokenResponse.error) {
          reject(new Error(tokenResponse.error));
          return;
        }
        
        accessToken = tokenResponse.access_token;
        
        // Set token for gapi.client
        gapi.client.setToken({ access_token: accessToken });
        
        // Initialize Sheets API
        await initGoogleAPI();
        
        resolve({
          accessToken,
          expiresIn: tokenResponse.expires_in
        });
      }
    });

    tokenClient.requestAccessToken();
  });
};

// Sign out user
export const signOutGoogle = async () => {
  try {
    if (accessToken) {
      // Revoke the token
      window.google.accounts.oauth2.revoke(accessToken, () => {
        console.log('Token revoked');
      });
    }
    accessToken = null;
    gapi.client.setToken(null);
  } catch (error) {
    console.error('Error signing out:', error);
  }
};

// Set club's pre-configured Gmail access token
export const setClubAccessToken = async (token) => {
  try {
    clubAccessToken = token;
    
    // Initialize Google API if not already done
    await initGoogleAPI();
    
    // Set the club's token
    gapi.client.setToken({ access_token: clubAccessToken });
    
    return true;
  } catch (error) {
    console.error('Error setting club token:', error);
    throw error;
  }
};

// Check if user is signed in
export const isSignedIn = () => {
  return (accessToken !== null || clubAccessToken !== null) && gapi.client.getToken() !== null;
};

// Get current user
export const getCurrentUser = async () => {
  try {
    if (!isSignedIn()) {
      return null;
    }
    
    const userInfo = await gapi.client.request({
      path: 'https://www.googleapis.com/oauth2/v2/userinfo',
      method: 'GET'
    });
    
    return userInfo.result;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
};

// Create a new spreadsheet for the user
export const createSpreadsheet = async (title = 'ID Document Scans') => {
  try {
    const response = await gapi.client.sheets.spreadsheets.create({
      resource: {
        properties: {
          title: title,
          locale: 'en_US',
          timeZone: 'America/Los_Angeles'
        },
        sheets: [{
          properties: {
            title: 'Documents',
            gridProperties: {
              rowCount: 1000,
              columnCount: 20,
              frozenRowCount: 1
            }
          }
        }]
      }
    });

    const spreadsheetId = response.result.spreadsheetId;
    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

    // Set up headers
    await setupSpreadsheetHeaders(spreadsheetId);

    return { spreadsheetId, spreadsheetUrl };
  } catch (error) {
    console.error('Error creating spreadsheet:', error);
    throw error;
  }
};

// Set up headers for the spreadsheet
const setupSpreadsheetHeaders = async (spreadsheetId) => {
  try {
    await gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Documents!A1:R1',
      valueInputOption: 'RAW',
      resource: {
        values: [[
          'Timestamp',
          'Document Type',
          'Name',
          'ID Number',
          'Date of Birth',
          'Gender',
          'Address',
          'Father Name',
          'Nationality',
          'Issue Date',
          'Expiry Date',
          'Place of Issue',
          'District',
          'State',
          'Pincode',
          'Other Info 1',
          'Other Info 2',
          'Raw Text'
        ]]
      }
    });
  } catch (error) {
    console.error('Error setting up headers:', error);
  }
};

// Append data to spreadsheet
export const appendToSpreadsheet = async (spreadsheetId, data) => {
  try {
    const extractedData = data.extractedData || {};
    const values = [[
      new Date().toISOString(),
      data.documentType || '',
      extractedData.name || '',
      extractedData.idNumber || extractedData.aadhaarNumber || extractedData.passportNumber || extractedData.panNumber || '',
      extractedData.dateOfBirth || '',
      extractedData.gender || '',
      extractedData.address || '',
      extractedData.fatherName || '',
      extractedData.nationality || '',
      extractedData.issueDate || '',
      extractedData.expiryDate || '',
      extractedData.placeOfIssue || '',
      extractedData.district || '',
      extractedData.state || '',
      extractedData.pincode || '',
      extractedData.otherInfo1 || '',
      extractedData.otherInfo2 || '',
      data.rawText || ''
    ]];

    const response = await gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Documents!A2',
      valueInputOption: 'RAW',
      resource: { values }
    });

    return response;
  } catch (error) {
    console.error('Error appending to spreadsheet:', error);
    throw error;
  }
};

const googleAuthService = {
  initGoogleAPI,
  signInGoogle,
  signOutGoogle,
  isSignedIn,
  getCurrentUser,
  createSpreadsheet,
  appendToSpreadsheet
};

export default googleAuthService;

