/**
 * Admin Service - For managing clubs and their configurations
 */

import { db } from '../firebase-config';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  serverTimestamp 
} from 'firebase/firestore';

/**
 * Create a new nightclub
 * @param {Object} clubData - Nightclub information
 * @param {string} clubData.name - Nightclub name
 * @param {string} clubData.username - Login username for app access
 * @param {string} clubData.password - Login password for app access (will be hashed)
 * @param {string} clubData.gmail - Gmail account email for Google Sheets
 * @param {string} clubData.gmailPassword - Gmail account password (will be encrypted)
 * @returns {Promise<Object>} Created nightclub data
 */
export const createClub = async (clubData) => {
  try {
    const { name, username, password, gmail, gmailPassword } = clubData;

    // Check if username already exists
    const existingClub = await getClubByUsername(username);
    if (existingClub) {
      throw new Error('Username already exists');
    }

    // Hash passwords (simple hash for now - in production use bcrypt)
    const hashedPassword = await hashPassword(password);
    const hashedGmailPassword = await hashPassword(gmailPassword); // Store Gmail password securely

    // Create club document
    const clubRef = doc(collection(db, 'clubs'));
    const clubId = clubRef.id;

    // Spreadsheet will be created on first login
    const clubDoc = {
      id: clubId,
      name: name.trim(),
      username: username.trim().toLowerCase(),
      passwordHash: hashedPassword,
      gmail: gmail.trim().toLowerCase(),
      gmailPasswordHash: hashedGmailPassword, // Store Gmail password (encrypted)
      gmailAccessToken: clubData.gmailAccessToken || null, // OAuth access token for Google Sheets
      gmailRefreshToken: clubData.gmailRefreshToken || null, // OAuth refresh token
      spreadsheetId: null,
      spreadsheetUrl: null,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: clubData.createdBy || 'admin'
    };

    await setDoc(clubRef, clubDoc);

    return {
      id: clubId,
      name: clubDoc.name,
      username: clubDoc.username,
      gmail: clubDoc.gmail,
      spreadsheetId: clubDoc.spreadsheetId,
      spreadsheetUrl: clubDoc.spreadsheetUrl
    };
  } catch (error) {
    console.error('Error creating nightclub:', error);
    throw error;
  }
};

/**
 * Get club by username
 */
export const getClubByUsername = async (username) => {
  try {
    const clubsRef = collection(db, 'clubs');
    const q = query(clubsRef, where('username', '==', username.trim().toLowerCase()));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    const clubDoc = querySnapshot.docs[0];
    return {
      id: clubDoc.id,
      ...clubDoc.data()
    };
  } catch (error) {
    console.error('Error getting club by username:', error);
    throw error;
  }
};

/**
 * Get club by ID
 */
export const getClubById = async (clubId) => {
  try {
    const clubRef = doc(db, 'clubs', clubId);
    const clubDoc = await getDoc(clubRef);

    if (!clubDoc.exists()) {
      return null;
    }

    return {
      id: clubDoc.id,
      ...clubDoc.data()
    };
  } catch (error) {
    console.error('Error getting club by ID:', error);
    throw error;
  }
};

/**
 * Get all clubs
 */
export const getAllClubs = async () => {
  try {
    const clubsRef = collection(db, 'clubs');
    const querySnapshot = await getDocs(clubsRef);

    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting all clubs:', error);
    throw error;
  }
};

/**
 * Update club
 */
export const updateClub = async (clubId, updates) => {
  try {
    const clubRef = doc(db, 'clubs', clubId);
    
    const updateData = {};
    
    // If password is being updated, hash it
    if (updates.password) {
      updateData.passwordHash = await hashPassword(updates.password);
    }
    
    // If Gmail password is being updated, hash it
    if (updates.gmailPassword) {
      updateData.gmailPasswordHash = await hashPassword(updates.gmailPassword);
    }
    
    // Add other safe updates
    if (updates.name) updateData.name = updates.name.trim();
    if (updates.gmail) updateData.gmail = updates.gmail.trim().toLowerCase();
    if (updates.gmailAccessToken !== undefined) updateData.gmailAccessToken = updates.gmailAccessToken || null;
    if (updates.gmailRefreshToken !== undefined) updateData.gmailRefreshToken = updates.gmailRefreshToken || null;
    
    updateData.updatedAt = serverTimestamp();
    
    await updateDoc(clubRef, updateData);

    return await getClubById(clubId);
  } catch (error) {
    console.error('Error updating nightclub:', error);
    throw error;
  }
};

/**
 * Delete club
 */
export const deleteClub = async (clubId) => {
  try {
    const clubRef = doc(db, 'clubs', clubId);
    await deleteDoc(clubRef);
    return true;
  } catch (error) {
    console.error('Error deleting club:', error);
    throw error;
  }
};

/**
 * Authenticate club with username and password
 */
export const authenticateClub = async (username, password) => {
  try {
    const club = await getClubByUsername(username);
    
    if (!club) {
      throw new Error('Invalid username or password');
    }

    if (!club.isActive) {
      throw new Error('Club account is inactive');
    }

    // Verify password
    const isValid = await verifyPassword(password, club.passwordHash);
    
    if (!isValid) {
      throw new Error('Invalid username or password');
    }

    // Return club data (without sensitive info)
    return {
      id: club.id,
      name: club.name,
      username: club.username,
      gmail: club.gmail,
      spreadsheetId: club.spreadsheetId,
      spreadsheetUrl: club.spreadsheetUrl,
      userType: 'club'
    };
  } catch (error) {
    console.error('Error authenticating club:', error);
    throw error;
  }
};

/**
 * Initialize or get spreadsheet for club
 */
export const initializeClubSpreadsheet = async (clubId) => {
  try {
    const club = await getClubById(clubId);
    
    if (!club) {
      throw new Error('Club not found');
    }

    // If club already has a spreadsheet, return it
    if (club.spreadsheetId && club.spreadsheetUrl) {
      return {
        spreadsheetId: club.spreadsheetId,
        spreadsheetUrl: club.spreadsheetUrl
      };
    }

    // Create new spreadsheet
    // Note: This requires the club's Gmail OAuth tokens
    // For now, we'll need to handle this differently
    // The admin should set up the Gmail account and tokens when creating the club
    
    throw new Error('Spreadsheet not initialized. Please contact admin.');
  } catch (error) {
    console.error('Error initializing club spreadsheet:', error);
    throw error;
  }
};

/**
 * Simple password hashing (for demo - use bcrypt in production)
 */
const hashPassword = async (password) => {
  // Simple hash for now - in production, use proper hashing like bcrypt
  // This is just a placeholder
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Verify password
 */
const verifyPassword = async (password, hash) => {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
};

const adminService = {
  createClub,
  getClubByUsername,
  getClubById,
  getAllClubs,
  updateClub,
  deleteClub,
  authenticateClub,
  initializeClubSpreadsheet
};

export default adminService;

