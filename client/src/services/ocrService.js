/**
 * OCR Service - FREE OCR providers only
 * 1. OCR.space API (free, no API key needed)
 * 2. Tesseract.js (fallback, client-side only)
 */

import { createWorker } from 'tesseract.js';

// OCR.space API (free tier available, API key optional but recommended)
const performOCRSpace = async (imageFile) => {
  try {
    const formData = new FormData();
    formData.append('file', imageFile);
    formData.append('language', 'eng+hin'); // English + Hindi (Devanagari) for Indian documents
    formData.append('isOverlayRequired', 'false');
    formData.append('detectOrientation', 'true');
    formData.append('scale', 'true');
    formData.append('OCREngine', '2'); // Engine 2 is more accurate
    formData.append('detectCheckbox', 'false');
    formData.append('isCreateSearchablePdf', 'false');
    formData.append('isSearchablePdfHideTextLayer', 'false');
    
    // Optional API key - if provided, use it (prevents 403 errors)
    const API_KEY = process.env.REACT_APP_OCR_SPACE_API_KEY;
    if (API_KEY) {
      formData.append('apikey', API_KEY);
    }

    const response = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: API_KEY ? {} : {
        // Some browsers may need this
      },
      body: formData
    });

    // Check response status
    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('OCR.space API: Access forbidden. May need API key or hit rate limit. Get free key at https://ocr.space/ocrapi');
      }
      throw new Error(`OCR.space API: HTTP ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.OCRExitCode === 1 && result.ParsedResults && result.ParsedResults.length > 0) {
      return {
        text: result.ParsedResults[0].ParsedText,
        confidence: 95, // OCR.space doesn't provide confidence, estimate high
        raw: result
      };
    } else {
      throw new Error('OCR.space API error: ' + (result.ErrorMessage || result.ErrorMessage[0]?.ErrorMessageText || 'Unknown error'));
    }
  } catch (error) {
    console.error('OCR.space API error:', error);
    throw error;
  }
};

// Preprocess image for better OCR accuracy
const preprocessImage = async (imageFile) => {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        // Canvas not supported, return original
        resolve(imageFile);
        return;
      }
      
      img.onload = () => {
        try {
          if (!img.width || !img.height) {
            resolve(imageFile);
            return;
          }
          
          canvas.width = img.width;
          canvas.height = img.height;
          
          // Draw image
          ctx.drawImage(img, 0, 0);
          
          // Get image data for processing
          let imageData;
          try {
            imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          } catch (e) {
            // CORS or other error, return original
            resolve(imageFile);
            return;
          }
          
          const data = imageData.data;
          
          // Apply image enhancement
          for (let i = 0; i < data.length; i += 4) {
            // Increase contrast
            const factor = 1.5;
            const contrast = 128;
            data[i] = Math.min(255, Math.max(0, (data[i] - contrast) * factor + contrast)); // R
            data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - contrast) * factor + contrast)); // G
            data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - contrast) * factor + contrast)); // B
            
            // Convert to grayscale for better OCR
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            data[i] = gray;
            data[i + 1] = gray;
            data[i + 2] = gray;
          }
          
          // Put processed image data back
          ctx.putImageData(imageData, 0, 0);
          
          // Convert canvas to blob
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(new File([blob], imageFile.name, { type: 'image/png' }));
            } else {
              resolve(imageFile); // Fallback to original
            }
          }, 'image/png');
        } catch (e) {
          console.warn('Image preprocessing error:', e);
          resolve(imageFile); // Fallback to original on error
        }
      };
      
      img.onerror = () => {
        resolve(imageFile); // Fallback to original if preprocessing fails
      };
      
      img.src = URL.createObjectURL(imageFile);
    } catch (e) {
      console.warn('Preprocessing setup error:', e);
      resolve(imageFile); // Fallback to original on any error
    }
  });
};

// Process document image with progress callback
// Uses OCR.space API (free) or Google Vision API (more accurate) or Tesseract.js (fallback)
export const processDocument = async (imageFile, onProgress = null) => {
  let worker = null;
  let progressInterval = null;
  
  try {
    if (onProgress) onProgress(0.1);
    
    let rawText = '';
    let confidence = 0;
    
    // ALWAYS try OCR.space API first (FREE, no API key needed)
    // This is the default and free option
    try {
      if (onProgress) onProgress(0.3);
      console.log('Using OCR.space API (FREE)...');
      const result = await performOCRSpace(imageFile);
      rawText = result.text;
      confidence = result.confidence;
      if (onProgress) onProgress(1);
    } catch (error) {
      console.warn('OCR.space (free) failed, falling back to Tesseract.js:', error);
      // Will fall through to Tesseract.js below
    }
    
    // Fallback to Tesseract.js (FREE, client-side only) if OCR.space failed
    if (!rawText) {
      if (onProgress) {
        let simulatedProgress = 20;
        progressInterval = setInterval(() => {
          simulatedProgress = Math.min(simulatedProgress + 5, 90);
          onProgress(simulatedProgress / 100);
        }, 200);
      }
      
      console.log('Using Tesseract.js (fallback)...');
      
      // Preprocess image for better OCR accuracy
      const processedImage = await preprocessImage(imageFile);
      if (onProgress) onProgress(0.4);
      
      // Create a fresh worker with multiple languages for Indian documents
      // eng+hin = English + Hindi (Devanagari)
      worker = await createWorker('eng+hin');
      
      // Set OCR parameters for better accuracy on documents
      try {
        // Try PSM 11 first (Sparse text - good for structured documents)
        await worker.setParameters({
          tessedit_pageseg_mode: '11', // Sparse text - better for structured documents like passports
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 /:,-.()आअइईउऊएऐओऔकखगघङचछजझञटठडढणतथदधनपफबभमयरलवशषसहळक्षज्ञ'
        });
      } catch (e) {
        console.warn('Failed to set OCR parameters, trying PSM 6:', e);
        try {
          // Fallback to PSM 6 (Uniform block of text)
          await worker.setParameters({
            tessedit_pageseg_mode: '6',
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 /:,-.()आअइईउऊएऐओऔकखगघङचछजझञटठडढणतथदधनपफबभमयरलवशषसहळक्षज्ञ'
          });
        } catch (e2) {
          console.warn('Failed to set OCR parameters, using defaults:', e2);
        }
      }
      
      // Perform OCR with optimized settings
      const { data } = await worker.recognize(processedImage);
      rawText = data.text;
      confidence = data.confidence;
      
      if (onProgress) {
        if (progressInterval) {
          clearInterval(progressInterval);
        }
        onProgress(1);
      }
    }
    
    if (!rawText) {
      throw new Error('All OCR methods failed');
    }
    
    const documentType = identifyDocumentType(rawText);
    const extractedData = extractDocumentData(rawText, documentType);
    
    return {
      documentType,
      rawText,
      extractedData,
      confidence
    };
  } catch (error) {
    console.error('OCR Error:', error);
    const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
    throw new Error('Failed to process document: ' + errorMessage);
  } finally {
    // Clear progress interval if it exists
    if (progressInterval) {
      clearInterval(progressInterval);
    }
    
    // Clean up worker after each recognition
    if (worker) {
      await worker.terminate();
    }
  }
};

// Clean and normalize text for better matching
const cleanText = (text) => {
  return text
    .replace(/\s+/g, ' ')  // Normalize whitespace
    .replace(/[<>]/g, ' ')  // Replace < > with spaces (common OCR error)
    .replace(/\$/g, '')     // Remove $ symbols (common OCR error)
    .trim();
};

// Identify document type based on text content - optimized for Indian documents
const identifyDocumentType = (text) => {
  const upperText = cleanText(text).toUpperCase();
  const originalText = text;
  
  // Check for Aadhaar - most distinctive patterns first
  // Aadhaar has: "GOVERNMENT OF INDIA", "AADHAAR", "मेरा आधार, मेरी पहचान", 12-digit number
  if ((upperText.includes('AADHAAR') || upperText.includes('आधार') || upperText.includes('AADHAR')) &&
      (upperText.includes('GOVERNMENT OF INDIA') || upperText.includes('भारत सरकार'))) {
    return 'aadhaar';
  }
  // Also check for 12-digit pattern (4-4-4 format) which is unique to Aadhaar
  if (/\d{4}\s\d{4}\s\d{4}/.test(text) && !upperText.includes('PAN') && !upperText.includes('PASSPORT')) {
    return 'aadhaar';
  }
  
  // Check for PAN - distinctive patterns
  // PAN has: "INCOME TAX DEPARTMENT", "PERMANENT ACCOUNT NUMBER", "स्थायी लेखा संख्या", PAN format ABCDE1234F
  if ((upperText.includes('INCOME TAX') || upperText.includes('आयकर विभाग')) &&
      (upperText.includes('PERMANENT ACCOUNT NUMBER') || upperText.includes('स्थायी लेखा संख्या') || upperText.includes('PAN'))) {
    return 'pan';
  }
  // Also check for PAN number format (10 characters: 5 letters + 4 digits + 1 letter)
  if (/[A-Z]{5}\d{4}[A-Z]/.test(upperText) && !upperText.includes('AADHAAR') && !upperText.includes('PASSPORT')) {
    return 'pan';
  }
  
  // Check for Passport - distinctive patterns
  // Passport has: "REPUBLIC OF INDIA", "PASSPORT", MRZ line (P<IND...), passport number (7-9 digits)
  if (upperText.includes('PASSPORT') || upperText.includes('पासपोर्ट') || /P<[A-Z]{3}/.test(originalText)) {
    return 'passport';
  }
  // Also check for passport number pattern near "REPUBLIC OF INDIA"
  if (upperText.includes('REPUBLIC OF INDIA') && (/\d{7,9}/.test(text) || /[A-Z]\d{7,9}/.test(upperText))) {
    return 'passport';
  }
  
  // Check for Driving License - distinctive patterns
  // DL has: "DRIVING LICENSE", "MOTOR VEHICLES", DL number format (XXYYNNNNNNNNNNN)
  if ((upperText.includes('DRIVING LICENSE') || upperText.includes('DRIVING LICENCE') || upperText.includes('ड्राइविंग लाइसेंस')) &&
      (upperText.includes('MOTOR') || upperText.includes('VEHICLES') || upperText.includes('TRANSPORT'))) {
    return 'driving_license';
  }
  // Also check for DL number format (2 letters + 2 digits + 4 digits + 7 digits = 15 characters)
  if (/[A-Z]{2}\d{2}\d{4}\d{7}/.test(upperText) && !upperText.includes('PAN') && !upperText.includes('AADHAAR')) {
    return 'driving_license';
  }
  
  // Check for Voter ID - distinctive patterns
  if ((upperText.includes('VOTER') || upperText.includes('मतदाता') || upperText.includes('EPIC')) &&
      (upperText.includes('ELECTION') || upperText.includes('COMMISSION'))) {
    return 'voter_id';
  }
  // Also check for Voter ID format (3 letters + 7 digits)
  if (/[A-Z]{3}\d{7}/.test(upperText) && !upperText.includes('PAN') && !upperText.includes('AADHAAR')) {
    return 'voter_id';
  }
  
  return 'other';
};

// Extract structured data based on document type
const extractDocumentData = (text, documentType) => {
  const data = {};
  
  switch (documentType) {
    case 'aadhaar':
      return extractAadhaarData(text);
    case 'passport':
      return extractPassportData(text);
    case 'pan':
      return extractPANData(text);
    case 'driving_license':
      return extractDrivingLicenseData(text);
    case 'voter_id':
      return extractVoterIDData(text);
    default:
      return data;
  }
};

// Extract Aadhaar card data - optimized for actual Aadhaar card layout
const extractAadhaarData = (text) => {
  const data = {};
  const cleanedText = cleanText(text);
  
  // Extract Aadhaar number (12 digits - most prominent on card)
  // Pattern: 4 digits space 4 digits space 4 digits (e.g., "3400 9872 2377")
  const aadhaarPatterns = [
    /\b(\d{4}\s\d{4}\s\d{4})\b/,  // Space separated (most common)
    /\b(\d{4}[-]\d{4}[-]\d{4})\b/,  // Hyphen separated
    /\b(\d{12})\b/,  // No spaces (fallback)
    /(?:Aadhaar|आधार|AADHAAR)[:\s]*(\d{4}\s?\d{4}\s?\d{4})/i
  ];
  
  for (const pattern of aadhaarPatterns) {
    const match = cleanedText.match(pattern);
    if (match) {
      const aadhaarNum = (match[1] || match[0]).trim();
      // Validate: should be 12 digits total
      if (aadhaarNum.replace(/\s|-/g, '').length === 12) {
        data.aadhaarNumber = aadhaarNum.replace(/-/g, ' '); // Normalize to spaces
        break;
      }
    }
  }
  
  // Extract Name - Look for Hindi name followed by English name
  // Pattern: Hindi name (Devanagari) followed by English name in ALL CAPS
  const namePatterns = [
    // Hindi name pattern: "विजय कुमार अग्रवाल" followed by "VIJAY KUMAR AGGRAWAL"
    /([\u0900-\u097F\s]{5,})\s+([A-Z][A-Z\s]{4,})/,
    // English name after "नाम" or "Name"
    /(?:नाम|Name)[:\s]+([A-Z][A-Z\s]{4,})/i,
    // Direct English name pattern (2-4 words, all caps, min 5 chars each)
    /\b([A-Z][A-Z]{4,}\s+[A-Z][A-Z]{3,}(?:\s+[A-Z][A-Z]{3,})?)\b(?=\s|$|\d|DOB|जन्म|Gender|पुरुष|महिला)/,
    // Fallback: any 2-3 word uppercase name
    /\b([A-Z][A-Z]{3,}\s+[A-Z][A-Z]{3,}(?:\s+[A-Z][A-Z]{3,})?)\b/
  ];
  
  for (const pattern of namePatterns) {
    const match = cleanedText.match(pattern);
    if (match) {
      // Use English name (second match) if Hindi+English pattern, otherwise use first match
      let name = (match[2] || match[1] || match[0]).trim().toUpperCase();
      // Skip false positives
      if (!name.match(/^(REPUBLIC|OF|INDIA|AADHAAR|आधार|GOVERNMENT|GOVT|GOVERNMENT OF|DOWNLOAD|ISSUE|DATE|VID|MOBILE|मेरा|आधार|मेरी|पहचान)$/i) &&
          name.length >= 5 &&
          name.split(/\s+/).length >= 2 &&
          !name.match(/^\d/)) {
        data.name = name;
        break;
      }
    }
  }
  
  // Extract Date of Birth - Format: "जन्म तारीख/DOB: 04/04/1985" or "18/04/1985"
  const dobPatterns = [
    /(?:जन्म\s+तारीख|DOB|Date\s+of\s+Birth)[:\s/]*(\d{2}[-/]\d{2}[-/]\d{4})/i,
    /(\d{2}[-/]\d{2}[-/]\d{4})\b(?:\s|.*?)(?:DOB|जन्म|Birth)/i,
    // Direct pattern: DD/MM/YYYY or DD-MM-YYYY
    /\b(\d{2}[-/]\d{2}[-/]\d{4})\b(?=\s|$|Gender|पुरुष|महिला|MALE|FEMALE)/
  ];
  
  for (const pattern of dobPatterns) {
    const match = cleanedText.match(pattern);
    if (match) {
      const date = match[1] || match[0];
      // Validate date format and reasonable year (1900-2010 for DOB)
      const year = parseInt(date.split(/[-/]/)[2]);
      if (date.match(/\d{2}[-/]\d{2}[-/]\d{4}/) && year >= 1900 && year <= 2010) {
        data.dateOfBirth = date;
        break;
      }
    }
  }
  
  // Extract Gender - Pattern: "पुरुष/ MALE" or "महिला/ FEMALE" or "MALE" or "FEMALE"
  const genderPatterns = [
    /(?:पुरुष|MALE|Male)[:\s/]*([MF]|MALE|FEMALE|Male|Female)/i,
    /(?:महिला|FEMALE|Female)[:\s/]*([MF]|MALE|FEMALE|Male|Female)/i,
    /\b([MF]|MALE|FEMALE)\b(?=\s|$|Gender|Sex|पुरुष|महिला)/i
  ];
  
  for (const pattern of genderPatterns) {
    const match = cleanedText.match(pattern);
    if (match) {
      const gender = (match[1] || match[0]).toUpperCase();
      if (gender === 'M' || gender === 'MALE' || gender.includes('पुरुष')) {
        data.gender = 'Male';
      } else if (gender === 'F' || gender === 'FEMALE' || gender.includes('महिला')) {
        data.gender = 'Female';
      }
      if (data.gender) break;
    }
  }
  
  // Extract Mobile Number - Pattern: "Mobile No: 9923076210" or "9923076210"
  const mobilePatterns = [
    /(?:Mobile\s+No|Mobile)[:\s]*(\d{10})/i,
    /\b(\d{10})\b(?=\s|$|VID|Download|Issue)/
  ];
  
  for (const pattern of mobilePatterns) {
    const match = cleanedText.match(pattern);
    if (match) {
      const mobile = match[1] || match[0];
      if (mobile.length === 10 && /^\d{10}$/.test(mobile)) {
        data.otherInfo1 = `Mobile: ${mobile}`;
        break;
      }
    }
  }
  
  // Extract VID (Virtual ID) - Pattern: "VID : 9138 4815 4763 1445"
  const vidPatterns = [
    /VID\s*:\s*(\d{4}\s\d{4}\s\d{4}\s\d{4})/i,
    /VID\s*:\s*(\d{16})/i
  ];
  
  for (const pattern of vidPatterns) {
    const match = cleanedText.match(pattern);
    if (match) {
      const vid = (match[1] || match[0]).trim();
      if (vid.replace(/\s/g, '').length === 16) {
        data.otherInfo2 = `VID: ${vid}`;
        break;
      }
    }
  }
  
  // Extract Address - Look for multi-line address after name/DOB/Gender
  const addressPatterns = [
    /(?:Address|पता)[:\s]+([^\n]+(?:\n[^\n]+){0,5})/i,
    /(?:पता)[:\s]+([^\n]+(?:\n[^\n]+){0,5})/i
  ];
  
  for (const pattern of addressPatterns) {
    const match = cleanedText.match(pattern);
    if (match) {
      let address = match[1].trim();
      address = address.replace(/\s+/g, ' ').replace(/\n\s*\n/g, ', ');
      // Exclude if it contains Aadhaar number or other identifiers
      if (address.length > 10 && !address.match(/\d{4}\s?\d{4}\s?\d{4}/)) {
        data.address = address;
        break;
      }
    }
  }
  
  // Extract Pincode (6 digits)
  const pincodeMatch = cleanedText.match(/\b(\d{6})\b/);
  if (pincodeMatch) {
    data.pincode = pincodeMatch[1];
  }
  
  return data;
};

// Extract Passport data
const extractPassportData = (text) => {
  const data = {};
  const cleanedText = cleanText(text);

  // Extract Passport Number - handle OCR errors like $, J=, T, etc.
  const passportRegexes = [
    /Passport\s*(?:No|Number|#)?[:\s]*([A-Z0-9-]+)/i,
    /[=:]\s*[A-Z]?\s*\$?\s*([0-9]{7,9})\b/,  // Handle "J = $3879331", "T 3879331", "= 3879331"
    /\$\s*([0-9]{7,9})\b/,  // Handle "$3879331"
    /\b([A-Z]\d{7,9})\b/,  // Format: A12345678 (single letter + 7-9 digits)
    /\b([A-Z]\s?\d{7,9})\b/,  // Format: "T 3879331" or "A12345678"
    /Passport\s+[A-Za-z]+\s+([A-Z0-9-]+)/i,
    // Look for passport number patterns in MRZ (Machine Readable Zone)
    /P<[A-Z]{3}[A-Z0-9]+([0-9]{7,9})/i  // MRZ format: P<INDIANNAME12345678
  ];
  
  for (const regex of passportRegexes) {
    const match = cleanedText.match(regex);
    if (match) {
      let passportNum = (match[1] || match[0]).replace(/Passport\s*/i, '').replace(/\$/g, '').replace(/^[A-Z]\s+/, '').trim(); // Remove leading letter+space
      // Extract only digits if it starts with a letter
      const digitMatch = passportNum.match(/(\d{7,9})/);
      if (digitMatch) {
        passportNum = digitMatch[1];
      }
      if (passportNum.length >= 7 && passportNum.length <= 9 && /^\d+$/.test(passportNum)) {
        data.passportNumber = passportNum;
        break;
      }
    }
  }

  // Extract Name - handle various patterns including common Indian names
  // Priority: Look for actual name patterns, not OCR artifacts
  const namePatterns = [
    /(?:Given\s+Name|Given\s+Name\(s\))[:\s]+([A-Z][A-Z\s]{2,})/i,
    /(?:नाम|Name)[:\s]+([A-Z][A-Z\s]{2,})/i,
    // Look for common Indian surname patterns followed by first name
    /\b(?:SINGH|KUMAR|SHARMA|PATEL|RAO|REDDY|MEHTA|GUPTA|VERMA|YADAV|MISHRA|JHA|SAXENA|TIWARI|JOSHI|CHAUDHARY|AGRAWAL|GUPTA|JAIN|MEHTA)\s+([A-Z][A-Z]{2,})\b/i,  // "SINGH ROHIT"
    // Look for first name followed by common surnames
    /\b([A-Z][A-Z]{3,})\s+(?:SINGH|KUMAR|SHARMA|PATEL|RAO|REDDY|MEHTA|GUPTA|VERMA|YADAV|MISHRA|JHA)\b/i,  // "ROHIT SINGH"
    // Look for full name pattern (2-3 words, all uppercase, minimum length)
    /\b([A-Z][A-Z]{3,}\s+[A-Z][A-Z]{3,}(?:\s+[A-Z][A-Z]{3,})?)\b(?=\s|$|\d|REPUBLIC|INDIA|OF|PASSPORT)/i,  // Full name, exclude if followed by false positives
    // Direct "SINGH ROHIT" or "ROHIT SINGH" pattern
    /\b(SINGH\s+[A-Z][A-Z]{2,}|[A-Z][A-Z]{2,}\s+SINGH)\b/i,
    /\b(KUMAR\s+[A-Z][A-Z]{2,}|[A-Z][A-Z]{2,}\s+KUMAR)\b/i,
    /\b(SHARMA\s+[A-Z][A-Z]{2,}|[A-Z][A-Z]{2,}\s+SHARMA)\b/i
  ];
  
  // Common false positives to exclude
  const falsePositives = /^(REPUBLIC|OF|INDIA|PASSPORT|REPUBLIC OF|DATE|BIRTH|P<IND|DEHRADUN|DUBAI|CODE|GOWNLRY|COUNTRY|COUNTRY CODE|M\s*\d+|गा|सिर|Ee|gi|SHAT|COUNTRY)$/i;
  
  for (const pattern of namePatterns) {
    const match = cleanedText.match(pattern);
    if (match) {
      let name = match[1] ? match[1].trim() : match[0].trim();
      
      // Skip common false positives and validate name
      if (name && 
          !falsePositives.test(name) &&
          name.length >= 5 &&  // Minimum length for a name
          name.split(/\s+/).length >= 2 &&  // At least 2 words
          !name.match(/^\d/) &&  // Doesn't start with number
          !name.match(/[<>$]/)) {  // Doesn't contain OCR artifacts
        
        // Try to get full name if we found surname or first name
        const nameWords = name.split(/\s+/);
        if (nameWords.length === 1 || (nameWords.length === 2 && nameWords[0].length >= 3 && nameWords[1].length >= 3)) {
          // Check if we can find the reverse pattern
          const reversePattern = nameWords.length === 2 ? 
            new RegExp(`\\b(${nameWords[1]}\\s+${nameWords[0]})\\b`, 'i') :
            new RegExp(`\\b(${nameWords[0]}\\s+(?:SINGH|KUMAR|SHARMA|PATEL|RAO|REDDY|MEHTA|GUPTA))\\b`, 'i');
          
          const reverseMatch = cleanedText.match(reversePattern);
          if (reverseMatch && reverseMatch[1].length > name.length) {
            name = reverseMatch[1];
          }
        }
        
        data.name = name.toUpperCase();
        break;
      }
    }
  }
  
  // Fallback: Look for "ROHIT SINGH" style patterns if nothing found
  if (!data.name) {
    const fallbackPattern = /\b([A-Z][A-Z]{4,}\s+(?:SINGH|KUMAR|SHARMA|PATEL|RAO|REDDY|MEHTA|GUPTA|VERMA|YADAV|MISHRA|JHA))\b/i;
    const fallbackMatch = cleanedText.match(fallbackPattern);
    if (fallbackMatch) {
      let name = fallbackMatch[1].trim();
      if (!falsePositives.test(name) && name.length >= 6) {
        data.name = name.toUpperCase();
      }
    }
  }

  // Extract Date of Birth - look for DD/MM/YYYY or DD-MM-YYYY patterns
  const dobPatterns = [
    /(?:Date\s+of\s+Birth|DOB|जन्म\s+तिथि|Birth)[:\s]*(\d{1,2}[-/]\d{1,2}[-/]\d{4})/i,
    /(\d{2}[-/]\d{2}[-/]\d{4})\b(?:\s|.*?)(?:Birth|जन्म|Date\s+of\s+Birth|DOB|M\s*\d{1,2}\/\d{2}\/\d{4})/i,
    /(?:Birth|जन्म)[:\s]*(\d{2}[-/]\d{2}[-/]\d{4})\b/i,
    /\b(\d{2}\/\d{2}\/\d{4})\b(?=\s|$)/  // Standalone date pattern DD/MM/YYYY
  ];
  
  // Find all dates and use context to identify DOB
  const allDates = cleanedText.match(/\b\d{2}[-/]\d{2}[-/]\d{4}\b/g);
  if (allDates && allDates.length > 0) {
    // First date in reasonable range (1900-2010) is likely DOB
    for (const date of allDates) {
      const year = parseInt(date.split(/[-/]/)[2]);
      if (year >= 1900 && year <= 2010) {
        data.dateOfBirth = date;
        break;
      }
    }
  }
  
  // Also try keyword-based extraction
  for (const pattern of dobPatterns) {
    const match = cleanedText.match(pattern);
    if (match) {
      const date = match[1] || match[0];
      if (date.match(/\d{1,2}[-/]\d{1,2}[-/]\d{4}/)) {
        data.dateOfBirth = date;
        break;
      }
    }
  }

  // Extract Issue Date - look for dates near Issue keywords or before 2020
  const issueDatePatterns = [
    /(?:Date\s+of\s+Issue|Issue\s+Date|जारी\s+तिथि|Issued)[:\s]*(\d{1,2}[-/]\d{1,2}[-/]\d{4})/i,
    /(\d{2}[-/]\d{2}[-/]\d{4})\b(?:\s|.*?)(?:Issue|जारी|Date\s+of\s+Issue)/i,
    /(?:Issue|जारी)[:\s]*(\d{2}[-/]\d{2}[-/]\d{4})\b/i
  ];
  
  // Find dates and identify issue date (usually between 2000-2020)
  if (allDates && allDates.length >= 2) {
    for (const date of allDates) {
      const year = parseInt(date.split(/[-/]/)[2]);
      if (year >= 2000 && year <= 2020 && date !== data.dateOfBirth) {
        data.issueDate = date;
        break;
      }
    }
  }
  
  // Also try keyword-based extraction
  for (const pattern of issueDatePatterns) {
    const match = cleanedText.match(pattern);
    if (match) {
      const date = match[1] || match[0];
      if (date.match(/\d{1,2}[-/]\d{1,2}[-/]\d{4}/) && date !== data.dateOfBirth) {
        data.issueDate = date;
        break;
      }
    }
  }

  // Extract Expiry Date - look for dates near Expiry/Valid keywords or after 2020
  const expiryDatePatterns = [
    /(?:Date\s+of\s+Expiry|Expiry\s+Date|Expires|Valid\s+until|Valid\s+upto)[:\s]*(\d{1,2}[-/]\d{1,2}[-/]\d{4})/i,
    /(\d{2}[-/]\d{2}[-/]\d{4})\b(?:\s|.*?)(?:Expiry|Expires|Valid)/i
  ];
  
  // Find dates and identify expiry date (usually after 2020 or issue date + 10 years)
  if (allDates && allDates.length >= 2) {
    for (const date of allDates) {
      const year = parseInt(date.split(/[-/]/)[2]);
      if ((year >= 2020 || year >= 2025) && date !== data.dateOfBirth && date !== data.issueDate) {
        data.expiryDate = date;
        break;
      }
    }
  }
  
  // Also try keyword-based extraction
  for (const pattern of expiryDatePatterns) {
    const match = cleanedText.match(pattern);
    if (match) {
      const date = match[1] || match[0];
      if (date.match(/\d{1,2}[-/]\d{1,2}[-/]\d{4}/) && date !== data.dateOfBirth && date !== data.issueDate) {
        data.expiryDate = date;
        break;
      }
    }
  }

  // Extract Place of Issue - handle common Indian cities and OCR errors
  const placePatterns = [
    /(?:Place\s+of\s+Issue|Place\s+of\s+Birth|जारी\s+करने\s+का\s+स्थान)[:\s]+([A-Z][A-Z\s]{2,})/i,
    /\b(DEHRADUN|DELHI|MUMBAI|KOLKATA|CHENNAI|BANGALORE|HYDERABAD|PUNE|AHMEDABAD|JAIPUR|LUCKNOW|KANPUR|NAGPUR|INDORE|THANE|BHOPAL|VISAKHAPATNAM|PATNA|VADODARA|GHAZIABAD|LUDHIANA|AGRA|NASHIK|FARIDABAD|MEERUT|RAJKOT|VARANASI|SRINAGAR|AMRITSAR|NOIDA|RANCHI|CHANDIGARH|JABALPUR|GWALIOR|RAIPUR|KOTA|BAREILLY|MORADABAD|MYSORE|GURGAON|ALIGARH|JALANDHAR|TIRUCHIRAPALLI|BHUBANESWAR|SALEM|WARANGAL|MIRA-BHAYANDAR|THIRUVANANTHAPURAM|BIHAR|SHARIF|SAHARANPUR|JODHPUR|DUBAI|BANGALURU)\b/i
  ];
  
  for (const pattern of placePatterns) {
    const match = cleanedText.match(pattern);
    if (match) {
      let place = (match[1] || match[0]).trim();
      // Skip if it's part of a date or number
      if (!place.match(/^\d/)) {
        data.placeOfIssue = place.toUpperCase();
        break;
      }
    }
  }

  // Extract Nationality
  const nationalityPatterns = [
    /(?:Nationality)[:\s]+(?:भारतीय|Indian|INDIAN|INDIA)/i,
    /(?:भारतीय|Indian)\s*(?:\/|\|)\s*(?:Nationality|राष्ट्रीयता)?/i
  ];
  
  for (const pattern of nationalityPatterns) {
    const match = text.match(pattern);
    if (match) {
      if (text.includes('भारतीय') || text.includes('Indian')) {
        data.nationality = 'Indian';
      }
      break;
    }
  }

  // Extract Gender/Sex
  const genderMatch = text.match(/(?:Sex|Gender)[:\s]+([MF|Male|Female|पुरुष|महिला])/i);
  if (genderMatch) {
    const gender = genderMatch[1].toUpperCase();
    if (gender.startsWith('M') || gender.includes('पुरुष')) {
      data.gender = 'Male';
    } else if (gender.startsWith('F') || gender.includes('महिला')) {
      data.gender = 'Female';
    }
  }

  return data;
};

// Extract PAN card data - optimized for actual PAN card layout
const extractPANData = (text) => {
  const data = {};
  const cleanedText = cleanText(text);

  // Extract PAN Number - format: ABCDE1234F (10 characters, 5 letters + 4 digits + 1 letter)
  // Handle OCR errors like Greek Alpha (Α) instead of Latin A
  const panPatterns = [
    /\b([A-ZΑ]{5}\d{4}[A-ZΑ])\b/,  // Standard format, handle Greek Alpha
    /(?:PAN|Permanent\s+Account\s+Number|पैन|पैन\s+नंबर)[:\s]*([A-ZΑ]{5}\d{4}[A-ZΑ])/i,
    /([A-ZΑ]{5}\d{4}[A-ZΑ])\b/,
    // Look for PAN near "e-Permanent Account Number Card" or "स्थायी लेखा संख्या"
    /(?:स्थायी|Permanent)[^\n]{0,50}?([A-ZΑ]{5}\d{4}[A-ZΑ])/i
  ];
  
  for (const pattern of panPatterns) {
    const match = cleanedText.match(pattern);
    if (match) {
      let pan = (match[1] || match[0]).trim();
      // Replace Greek Alpha with Latin A if found
      pan = pan.replace(/Α/g, 'A');
      // Validate PAN format
      if (/^[A-Z]{5}\d{4}[A-Z]$/.test(pan)) {
        data.panNumber = pan;
        break;
      }
    }
  }

  // Extract Name - Pattern: "नाम / Name" followed by name in ALL CAPS
  // Example: "VIJAY KUMAR AGGRAWAL"
  const namePatterns = [
    // Hindi + English pattern
    /(?:नाम|Name)[:\s/]+([A-Z][A-Z\s]{4,})/i,
    // Direct name after "Income Tax Department" or card type
    /(?:स्थायी|Permanent|Account|Number|Card|कार्ड)[^\n]{0,30}?([A-Z][A-Z]{3,}\s+[A-Z][A-Z]{3,}(?:\s+[A-Z][A-Z]{3,})?)/,
    // Standard 2-3 word uppercase name pattern
    /\b([A-Z][A-Z]{3,}\s+[A-Z][A-Z]{3,}(?:\s+[A-Z][A-Z]{3,})?)\b(?=\s|$|\n|Father|पिता|Date|जन्म)/
  ];
  
  for (const pattern of namePatterns) {
    const match = cleanedText.match(pattern);
    if (match) {
      let name = (match[1] || match[0]).trim().toUpperCase();
      // Skip false positives
      if (!name.match(/^(INCOME|TAX|DEPARTMENT|PAN|GOVERNMENT|GOVT|GOVT\.|OF|INDIA|स्थायी|लेखा|संख्या|कार्ड|E-PERMANENT|PERMANENT|ACCOUNT|NUMBER|CARD)$/i) &&
          name.length >= 5 &&
          name.split(/\s+/).length >= 2 &&
          !name.match(/^\d/)) {
        data.name = name;
        break;
      }
    }
  }

  // Extract Father's Name - Pattern: "पिता का नाम / Father's Name" followed by name
  // Example: "RAJENDRA PRASAD AGGRAWAL"
  const fatherNamePatterns = [
    /(?:पिता\s+का\s+नाम|Father'?s?\s+Name|Father)[:\s/]+([A-Z][A-Z\s]{4,})/i,
    /(?:Father)[:\s]+([A-Z][A-Z]{3,}\s+[A-Z][A-Z]{3,}(?:\s+[A-Z][A-Z]{3,})?)/i
  ];
  
  for (const pattern of fatherNamePatterns) {
    const match = cleanedText.match(pattern);
    if (match) {
      let fatherName = (match[1] || match[0]).trim().toUpperCase();
      // Skip if it's actually the person's name (check if it matches name pattern)
      if (!fatherName.match(/^(INCOME|TAX|DEPARTMENT|PAN|GOVERNMENT|GOVT|Name|नाम)$/i) &&
          fatherName.length >= 5 &&
          fatherName.split(/\s+/).length >= 2) {
        data.fatherName = fatherName;
        break;
      }
    }
  }

  // Extract Date of Birth - Pattern: "जन्म की तारीख / Date of Birth" followed by "18/04/1985"
  const dobPatterns = [
    /(?:जन्म\s+की\s+तारीख|Date\s+of\s+Birth|DOB|Birth)[:\s/]+(\d{2}[-/]\d{2}[-/]\d{4})/i,
    /(\d{2}[-/]\d{2}[-/]\d{4})\b(?:\s|.*?)(?:Birth|जन्म|DOB|Date)/i,
    // Direct date pattern near birth keywords
    /\b(\d{2}[-/]\d{2}[-/]\d{4})\b(?=\s|$|\n|Signature|हस्ताक्षर)/
  ];
  
  for (const pattern of dobPatterns) {
    const match = cleanedText.match(pattern);
    if (match) {
      const date = match[1] || match[0];
      // Validate date format and reasonable year (1900-2010 for DOB)
      const year = parseInt(date.split(/[-/]/)[2]);
      if (date.match(/\d{2}[-/]\d{2}[-/]\d{4}/) && year >= 1900 && year <= 2010) {
        data.dateOfBirth = date;
        break;
      }
    }
  }

  return data;
};

// Extract Driving License data
const extractDrivingLicenseData = (text) => {
  const data = {};

  // Extract License Number - various formats
  const licensePatterns = [
    /\b[A-Z]{2}\d{2}\d{4}\d{7}\b/,  // Standard format: XXYYNNNNNNNNNNN
    /\b[A-Z]{2}\s?\d{2}\s?\d{4}\s?\d{7}\b/,  // With spaces
    /(?:License\s+No|DL\s+No|Driving\s+License)[:\s]*([A-Z]{2}[\s-]?\d{13})/i,
    /(?:DL\s+No)[:\s]*([A-Z]{2}\d{2}\d{4}\d{7})/i
  ];
  
  for (const pattern of licensePatterns) {
    const match = text.match(pattern);
    if (match) {
      data.idNumber = (match[1] || match[0]).replace(/\s/g, '');
      break;
    }
  }

  // Extract Name
  const namePatterns = [
    /(?:Name|नाम)[:\s]+([A-Z][A-Z\s]{2,})/i,
    /(?:Licensee'?s?\s+Name)[:\s]+([A-Z][A-Z\s]{2,})/i,
    /\b([A-Z][A-Z]{2,}\s+[A-Z]+\s+[A-Z]+)\b/,
    /\b([A-Z][A-Z]{2,}\s+[A-Z]+)\b/
  ];
  
  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match) {
      let name = (match[1] || match[0]).trim();
      if (!name.match(/^(DRIVING|LICENSE|MOTOR|VEHICLES|TRANSPORT)$/i)) {
        data.name = name;
        break;
      }
    }
  }

  // Extract Date of Birth
  const dobPatterns = [
    /(?:Date\s+of\s+Birth|DOB|जन्म\s+तिथि)[:\s]+(\d{1,2}[-/]\d{1,2}[-/]\d{4})/i,
    /(?:Birth)[:\s]*(\d{2}[-/]\d{2}[-/]\d{4})\b/i,
    /(\d{2}[-/]\d{2}[-/]\d{4})\b(?:\s|.*?)(?:Birth|DOB)/i
  ];
  
  for (const pattern of dobPatterns) {
    const match = text.match(pattern);
    if (match) {
      const date = match[1] || match[0];
      if (date.match(/\d{1,2}[-/]\d{1,2}[-/]\d{4}/)) {
        data.dateOfBirth = date;
        break;
      }
    }
  }

  // Extract Issue Date
  const issueDatePatterns = [
    /(?:Date\s+of\s+Issue|Issued|Issue\s+Date)[:\s]+(\d{1,2}[-/]\d{1,2}[-/]\d{4})/i,
    /(?:Issue)[:\s]*(\d{2}[-/]\d{2}[-/]\d{4})\b/i
  ];
  
  for (const pattern of issueDatePatterns) {
    const match = text.match(pattern);
    if (match) {
      const date = match[1] || match[0];
      if (date.match(/\d{1,2}[-/]\d{1,2}[-/]\d{4}/)) {
        data.issueDate = date;
        break;
      }
    }
  }

  // Extract Expiry Date
  const expiryDatePatterns = [
    /(?:Valid\s+Till|Valid\s+Until|Expiry\s+Date)[:\s]+(\d{1,2}[-/]\d{1,2}[-/]\d{4})/i,
    /(?:Valid)[:\s]*(\d{2}[-/]\d{2}[-/]\d{4})\b/i
  ];
  
  for (const pattern of expiryDatePatterns) {
    const match = text.match(pattern);
    if (match) {
      const date = match[1] || match[0];
      if (date.match(/\d{1,2}[-/]\d{1,2}[-/]\d{4}/)) {
        data.expiryDate = date;
        break;
      }
    }
  }

  // Extract Address
  const addressPatterns = [
    /(?:Address|पता)[:\s]+([^\n]+(?:\n[^\n]+){0,3})/i,
    /(?:Residence|पता)[:\s]+([^\n]+(?:\n[^\n]+){0,3})/i
  ];
  
  for (const pattern of addressPatterns) {
    const match = text.match(pattern);
    if (match) {
      let address = match[1].trim();
      address = address.replace(/\s+/g, ' ').replace(/\n\s*\n/g, ', ');
      if (address.length > 10) {
        data.address = address;
        break;
      }
    }
  }

  // Extract Pincode
  const pincodeMatch = text.match(/\b\d{6}\b/);
  if (pincodeMatch) {
    data.pincode = pincodeMatch[0];
  }

  return data;
};

// Extract Voter ID data
const extractVoterIDData = (text) => {
  const data = {};

  // Extract Voter ID Number - format: XXX1234567
  const voterIdPatterns = [
    /\b[A-Z]{3}\d{7}\b/,
    /(?:Voter\s+ID|EPIC\s+No|Electors\s+Photo\s+Identity\s+Card)[:\s]*([A-Z]{3}\d{7})/i,
    /(?:EPIC)[:\s]*([A-Z]{3}\d{7})/i
  ];
  
  for (const pattern of voterIdPatterns) {
    const match = text.match(pattern);
    if (match) {
      data.idNumber = match[1] || match[0];
      break;
    }
  }

  // Extract Name
  const namePatterns = [
    /(?:Name|नाम)[:\s]+([A-Z][A-Z\s]{2,})/i,
    /(?:Elector'?s?\s+Name)[:\s]+([A-Z][A-Z\s]{2,})/i,
    /\b([A-Z][A-Z]{2,}\s+[A-Z]+\s+[A-Z]+)\b/,
    /\b([A-Z][A-Z]{2,}\s+[A-Z]+)\b/
  ];
  
  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match) {
      let name = (match[1] || match[0]).trim();
      if (!name.match(/^(ELECTION|COMMISSION|VOTER|EPIC|GOVERNMENT)$/i)) {
        data.name = name;
        break;
      }
    }
  }

  // Extract Father's/Husband's Name
  const fatherNamePatterns = [
    /(?:Father'?s?\s+Name|पिता\s+का\s+नाम)[:\s]+([A-Z][A-Z\s]{2,})/i,
    /(?:Husband'?s?\s+Name|पति\s+का\s+नाम)[:\s]+([A-Z][A-Z\s]{2,})/i,
    /(?:Father|Husband)[:\s]+([A-Z][A-Z\s]{2,})/i
  ];
  
  for (const pattern of fatherNamePatterns) {
    const match = text.match(pattern);
    if (match) {
      data.fatherName = (match[1] || match[0]).trim();
      break;
    }
  }

  // Extract Date of Birth
  const dobPatterns = [
    /(?:Date\s+of\s+Birth|DOB|जन्म\s+तिथि|Age)[:\s]+(\d{1,2}[-/]\d{1,2}[-/]\d{4})/i,
    /(?:Birth)[:\s]*(\d{2}[-/]\d{2}[-/]\d{4})\b/i,
    /(\d{2}[-/]\d{2}[-/]\d{4})\b(?:\s|.*?)(?:Birth|DOB|Age)/i
  ];
  
  for (const pattern of dobPatterns) {
    const match = text.match(pattern);
    if (match) {
      const date = match[1] || match[0];
      if (date.match(/\d{1,2}[-/]\d{1,2}[-/]\d{4}/)) {
        data.dateOfBirth = date;
        break;
      }
    }
  }

  // Extract Address
  const addressPatterns = [
    /(?:Address|पता)[:\s]+([^\n]+(?:\n[^\n]+){0,4})/i,
    /(?:Electoral\s+Roll|Address)[:\s]+([^\n]+(?:\n[^\n]+){0,3})/i
  ];
  
  for (const pattern of addressPatterns) {
    const match = text.match(pattern);
    if (match) {
      let address = match[1].trim();
      address = address.replace(/\s+/g, ' ').replace(/\n\s*\n/g, ', ');
      if (address.length > 10) {
        data.address = address;
        break;
      }
    }
  }

  // Extract Gender
  const genderMatch = text.match(/(?:Sex|Gender)[:\s]+([MF]|Male|Female|पुरुष|महिला)/i);
  if (genderMatch) {
    const gender = genderMatch[1].toUpperCase();
    if (gender === 'M' || gender === 'MALE' || gender.includes('पुरुष')) {
      data.gender = 'Male';
    } else if (gender === 'F' || gender === 'FEMALE' || gender.includes('महिला')) {
      data.gender = 'Female';
    }
  }

  // Extract Assembly/Constituency
  const assemblyMatch = text.match(/(?:Assembly|Constituency)[:\s]+([A-Z][A-Z\s]{2,})/i);
  if (assemblyMatch) {
    data.otherInfo1 = (assemblyMatch[1] || assemblyMatch[0]).trim();
  }

  // Extract Pincode
  const pincodeMatch = text.match(/\b\d{6}\b/);
  if (pincodeMatch) {
    data.pincode = pincodeMatch[0];
  }

  return data;
};

// Cleanup (no longer needed since we create workers per recognition)
export const cleanup = async () => {
  // Workers are cleaned up after each recognition
  // This function is kept for API compatibility
};

const ocrService = {
  processDocument,
  cleanup
};

export default ocrService;

