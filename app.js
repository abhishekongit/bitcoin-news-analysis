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
        // Log configuration and date
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        console.log('Current time:', now.toISOString());
        console.log('Yesterday:', yesterday.toISOString());
        console.log('Formatted date:', formattedDate);

        // Create query parameters once
        const queryParams = new URLSearchParams({
            q: 'bitcoin',
            from: formattedDate,
            sortBy: 'publishedAt',
            language: 'en',
            pageSize: 100,
            apiKey: API_KEY
        });

        // Try multiple approaches
        const approaches = [
            // Direct request (should work since API key is valid)
            { name: 'direct', url: `${NEWS_API_BASE_URL}?${queryParams}` },
            // Try with cors-anywhere
            { name: 'cors-anywhere', url: `${proxyUrl}${NEWS_API_BASE_URL}?${queryParams}` },
            // Try with alternative CORS proxy
            { name: 'alternative-proxy', url: `https://api.allorigins.win/get?url=${encodeURIComponent(`${NEWS_API_BASE_URL}?${queryParams}`)}` }
        ];

        let successfulResponse;
        for (const approach of approaches) {
            console.log(`Trying ${approach.name} approach...`);
            try {
                const response = await fetch(approach.url);
                if (response.ok) {
                    console.log(`${approach.name} approach succeeded!`);
                    successfulResponse = response;
                    break;
                }
                console.log(`${approach.name} failed with status: ${response.status}`);
            } catch (error) {
                console.error(`${approach.name} failed:`, error);
            }
        }

        if (!successfulResponse) {
            throw new Error('All approaches failed to fetch data');
        }

        const responseText = await successfulResponse.text();
        try {
            // For alternative proxy, we need to parse the proxy response
            let data;
            if (approach.name === 'alternative-proxy') {
                const proxyResponse = JSON.parse(responseText);
                data = JSON.parse(proxyResponse.contents);
            } else {
                data = JSON.parse(responseText);
            }

            console.log('API Response:', data);
            
            if (data.status !== 'ok') {
                throw new Error(`News API error: ${data.message || 'Unknown error'}`);
            }

            return data.articles || [];
        } catch (parseError) {
            console.error('API response text:', responseText);
            throw new Error(`Invalid JSON response: ${parseError.message}. Raw response: ${responseText.substring(0, 200)}`);
        }
        // Log the full URL for debugging (mask API key)
        const fullUrl = `${NEWS_API_BASE_URL}?${params}`;
        console.log('Fetching from:', fullUrl.replace(API_KEY, '***'));

        // Make the request
        const response = await fetch(fullUrl);
        
        if (!response.ok) {
            // Get the response text to see what error we're getting
            const errorText = await response.text();
            console.error('API error response:', errorText);
            throw new Error(`API request failed with status: ${response.status}. Response: ${errorText}`);
        }

        const text = await response.text();
        try {
            console.log('Raw response:', text.substring(0, 200)); // Log first 200 chars
            const data = JSON.parse(text);
            console.log('API Response:', data);
            
            if (data.status !== 'ok') {
                throw new Error(`News API error: ${data.message || 'Unknown error'}`);
            }

            return data.articles || [];
        } catch (parseError) {
            console.error('API response text:', text);
            throw new Error(`Invalid JSON response: ${parseError.message}. Raw response: ${text.substring(0, 200)}`);
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
