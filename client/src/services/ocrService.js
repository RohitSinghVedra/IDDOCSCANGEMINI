/**
 * OCR Service - FREE OCR providers only
 * 1. OCR.space API (free, no API key needed)
 * 2. Tesseract.js (fallback, client-side only)
 */

import { createWorker } from 'tesseract.js';
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

