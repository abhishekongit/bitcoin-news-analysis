// Get variables from global scope (defined in HTML)
const proxyUrl = window.proxyUrl || '';
const API_KEY = window.API_KEY || '';
const NEWS_API_BASE_URL = window.NEWS_API_BASE_URL || '';
const DEFAULT_QUERY_PARAMS = window.DEFAULT_QUERY_PARAMS || {};
const formattedDate = window.formattedDate || '';

// Update status message function
const updateStatus = window.updateStatus || ((message, type) => {
    console.log(`Status: ${message}`);
});

// Initialize function to start the application
async function initialize() {
    if (!proxyUrl || !API_KEY || !NEWS_API_BASE_URL || !formattedDate) {
        updateStatus('Missing required configuration', 'danger');
        return;
    }
    try {
        updateStatus('Fetching news articles...', 'info');
        const articles = await fetchNews();
        if (!articles || articles.length === 0) {
            updateStatus('No articles found', 'warning');
            return;
        }
        await processArticles(articles);
        updateStatus('Articles loaded successfully', 'success');
    } catch (error) {
        console.error('Error initializing:', error);
        updateStatus(`Failed to initialize: ${error.message}`, 'danger');
    }
}

async function fetchNews() {
    try {
        // Create query parameters
        const params = new URLSearchParams({
            q: 'bitcoin',
            from: formattedDate,
            sortBy: 'publishedAt',
            language: 'en',
            pageSize: 100,
            apiKey: API_KEY
        });

        // Log the full URL for debugging
        const fullUrl = `${NEWS_API_BASE_URL}?${params}`;
        console.log('Fetching from:', fullUrl);

        // Make the request
        const response = await fetch(fullUrl);
        
        if (!response.ok) {
            throw new Error(`API request failed with status: ${response.status}`);
        }

        const text = await response.text();
        try {
            const data = JSON.parse(text);
            console.log('API Response:', data);
            
            if (data.status !== 'ok') {
                throw new Error(`News API error: ${data.message || 'Unknown error'}`);
            }

            return data.articles || [];
        } catch (parseError) {
            console.error('API response text:', text);
            throw new Error(`Invalid JSON response: ${parseError.message}`);
        }
    } catch (error) {
        console.error('Error fetching news:', error);
        updateStatus(`Error loading news: ${error.message}`, 'danger');
        throw error;
    }
}

// Simple sentiment analysis using keywords
function analyzeSentiment(text) {
    const bullishKeywords = ['rise', 'gain', 'up', 'increase', 'bull', 'positive', 'optimistic', 'growth', 'strong', 'upward'];
    const bearishKeywords = ['fall', 'drop', 'down', 'decrease', 'bear', 'negative', 'pessimistic', 'weak', 'downward', 'loss'];
    
    const textLower = text.toLowerCase();
    
    // Count keyword occurrences
    let bullishScore = 0;
    let bearishScore = 0;
    
    bullishKeywords.forEach(keyword => {
        bullishScore += (textLower.match(new RegExp(keyword, 'g')) || []).length;
    });
    
    bearishKeywords.forEach(keyword => {
        bearishScore += (textLower.match(new RegExp(keyword, 'g')) || []).length;
    });
    
    return {
        score: bullishScore - bearishScore,
        bullishScore,
        bearishScore
    };
}

function processArticles(articles) {
    if (!articles || !Array.isArray(articles)) {
        console.error('Invalid articles data:', articles);
        updateStatus('Invalid news articles data received', 'danger');
        return;
    }

    let bullishContent = '';
    let bearishContent = '';
    const newsList = document.getElementById('newsArticles');
    
    // Clear loading message
    newsList.innerHTML = '';

    for (const article of articles) {
        try {
            // Create news item
            const newsItem = document.createElement('div');
            newsItem.className = 'card mb-3';
            
            // Handle undefined values safely
            const title = article.title || 'No title available';
            const description = article.description || 'No description available';
            const url = article.url || '#';
            
            newsItem.innerHTML = `
                <div class="card-body">
                    <h5 class="card-title">${title}</h5>
                    <p class="card-text">${description}</p>
                    <a href="${url}" class="btn btn-primary" target="_blank">Read More</a>
                </div>
            `;
            newsList.appendChild(newsItem);

            // Analyze sentiment
            const sentiment = analyzeSentiment(description || title);
            
            // Add to appropriate summary
            if (sentiment.score > 0) {
                bullishContent += `<p><strong>${title}</strong>: ${description}</p>`;
            } else if (sentiment.score < 0) {
                bearishContent += `<p><strong>${title}</strong>: ${description}</p>`;
            }
        } catch (error) {
            console.error('Error processing article:', error);
            continue;
        }
    }

    // Update summaries
    document.getElementById('bullishSummary').innerHTML = `
        <h4>Bullish Articles (${bullishContent.split('<p>').length - 1} articles)</h4>
        ${bullishContent}
    `;
    document.getElementById('bearishSummary').innerHTML = `
        <h4>Bearish Articles (${bearishContent.split('<p>').length - 1} articles)</h4>
        ${bearishContent}
    `;
}

// Main function to initialize the application
async function initialize() {
    try {
        const articles = await fetchNews();
        await processArticles(articles);
    } catch (error) {
        console.error('Error initializing:', error);
        document.getElementById('bullishSummary').innerHTML = 'Error loading data. Please try again later.';
        document.getElementById('bearishSummary').innerHTML = 'Error loading data. Please try again later.';
    }
}

// Start the application
document.addEventListener('DOMContentLoaded', initialize);
