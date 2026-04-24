// Sample data for testing the mind map visualization
// Copy this to your browser console to test without uploading

const sampleTopicsData = {
  topics: [
    {
      name: "Machine Learning",
      subtopics: ["Neural Networks", "Deep Learning", "Natural Language Processing"]
    },
    {
      name: "Computer Vision",
      subtopics: ["Image Recognition", "Object Detection", "Segmentation"]
    },
    {
      name: "Data Science",
      subtopics: ["Data Analysis", "Statistics", "Data Visualization"]
    },
    {
      name: "Cloud Computing",
      subtopics: ["AWS", "Google Cloud", "Azure"]
    },
    {
      name: "Web Development",
      subtopics: ["Frontend", "Backend", "Database Design"]
    }
  ],
  allKeywords: [
    "artificial intelligence",
    "algorithms",
    "data structures",
    "optimization",
    "distributed systems",
    "scalability",
    "performance",
    "security",
    "testing",
    "deployment"
  ],
  confidence: 0.92
};

// How to use:
// 1. Open browser DevTools (F12)
// 2. Go to Application/Storage -> Local Storage
// 3. Create an entry with key "conceptGraphTopics" and value JSON.stringify(sampleTopicsData)
// 4. Or paste this code in console and run it to set localStorage
// localStorage.setItem('conceptGraphTopics', JSON.stringify(sampleTopicsData));

export default sampleTopicsData;
