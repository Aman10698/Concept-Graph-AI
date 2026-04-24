import { useState } from 'react';
import { uploadAndExtract } from '../services/textExtractionService';

export const useTextExtraction = () => {
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const [extractionMeta, setExtractionMeta] = useState(null);
  const [error, setError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const extract = async (file) => {
    if (!file) {
      setError('No file provided');
      return null;
    }

    setIsExtracting(true);
    setError(null);
    setUploadProgress(0);

    try {
      const result = await uploadAndExtract(file, (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        setUploadProgress(percentCompleted);
      });

      setExtractedText(result.extraction.text);
      setExtractionMeta({
        fileType: file.type,
        fileName: file.name,
        fileSize: file.size,
        ...result.extraction,
      });

      setIsExtracting(false);
      return result;
    } catch (err) {
      const errorMessage = err.message || 'Extraction failed';
      setError(errorMessage);
      setIsExtracting(false);
      return null;
    }
  };

  const clearResults = () => {
    setExtractedText('');
    setExtractionMeta(null);
    setError(null);
    setUploadProgress(0);
  };

  return {
    extract,
    isExtracting,
    extractedText,
    extractionMeta,
    error,
    uploadProgress,
    clearResults,
  };
};
