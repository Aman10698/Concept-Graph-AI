const textExtractionService = require('../services/textExtractionService');

const extractFromFile = async (req, res) => {
  try {
    const { filename, mimetype } = req.body;

    if (!filename || !mimetype) {
      return res.status(400).json({
        success: false,
        message: 'Filename and mimetype are required',
      });
    }

    const path = require('path');
    const filePath = path.join(__dirname, '..', 'uploads', filename);

    console.log(`\n📥 Extraction request received for: ${filename}`);
    console.log(`   File path: ${filePath}`);
    console.log(`   MIME type: ${mimetype}`);

    const result = await textExtractionService.extractText(filePath, mimetype);

    console.log(`✅ Extraction successful: ${result.text.length} chars extracted`);

    res.status(200).json({
      success: true,
      message: 'Text extracted successfully',
      data: result,
    });
  } catch (error) {
    console.error('❌ Extraction error:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Error extracting text',
      error: error.message,
      help: 'Make sure the file is a valid PDF, image, or text file with readable content',
    });
  }
};

module.exports = {
  extractFromFile,
};
