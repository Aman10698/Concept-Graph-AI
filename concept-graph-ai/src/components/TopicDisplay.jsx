import React from 'react';

const TopicDisplay = ({ topics, isLoading, error, onRetry }) => {
  if (isLoading) {
    return (
      <div className="w-full max-w-2xl mx-auto p-6">
        <div className="flex justify-center items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-lg text-gray-600">Analyzing topics...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-2xl mx-auto p-6">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 font-medium">Error</p>
          <p className="text-red-700 text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!topics) {
    return null;
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-6 space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Extracted Topics</h2>

      {/* Main Topics */}
      <div className="space-y-4">
        {topics.topics && topics.topics.length > 0 ? (
          topics.topics.map((topic, index) => (
            <div
              key={index}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start space-x-3">
                <div className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-semibold">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-800">
                    {topic.name}
                  </h3>

                  {/* Subtopics */}
                  {topic.subtopics && topic.subtopics.length > 0 && (
                    <div className="mt-3 pl-4 border-l-2 border-gray-300">
                      <p className="text-sm text-gray-600 font-medium mb-2">
                        Subtopics:
                      </p>
                      <ul className="space-y-2">
                        {topic.subtopics.map((subtopic, subIndex) => (
                          <li
                            key={subIndex}
                            className="text-sm text-gray-700 flex items-center"
                          >
                            <span className="inline-block w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                            {subtopic}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-gray-500">No topics extracted</p>
        )}
      </div>

      {/* All Keywords */}
      {topics.allKeywords && topics.allKeywords.length > 0 && (
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">
            Key Concepts
          </h3>
          <div className="flex flex-wrap gap-2">
            {topics.allKeywords.map((keyword, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Confidence Score */}
      {topics.confidence && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">
              Extraction Confidence
            </span>
            <span className="text-sm font-semibold text-gray-800">
              {Math.round(topics.confidence * 100)}%
            </span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${topics.confidence * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default TopicDisplay;
