const fs = require('fs');
const path = require('path');

const uploadFile = (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const fileInfo = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      uploadedAt: new Date().toISOString(),
    };

    res.status(200).json({
      success: true,
      message: 'File uploaded successfully',
      file: fileInfo,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading file',
      error: error.message,
    });
  }
};

const deleteFile = (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, '..', 'uploads', filename);

    // Prevent directory traversal attacks
    if (!filePath.startsWith(path.join(__dirname, '..', 'uploads'))) {
      return res.status(400).json({ message: 'Invalid file path' });
    }

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.status(200).json({
        success: true,
        message: 'File deleted successfully',
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'File not found',
      });
    }
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting file',
      error: error.message,
    });
  }
};

module.exports = {
  uploadFile,
  deleteFile,
};
