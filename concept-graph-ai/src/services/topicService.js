import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export const extractTopicsFromText = async (text) => {
  try {
    if (!text || text.trim().length < 50) {
      throw new Error('Text must be at least 50 characters long');
    }

    const response = await axios.post(`${API_BASE_URL}/topics`, {
      text,
    });

    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.message ||
      error.message ||
      'Failed to extract topics'
    );
  }
};
