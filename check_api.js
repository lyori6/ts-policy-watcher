// Check if the weekly summaries API is working
fetch('http://localhost:3005/dashboard/weekly_summaries.json')
    .then(response => {
        console.log('Response status:', response.status);
        if (response.status === 404) {
            console.log('File not found - trying root directory...');
            return fetch('http://localhost:3005/weekly_summaries.json');
        }
        return response;
    })
    .then(response => response.json())
    .then(data => {
        console.log('Weekly summaries data keys:', Object.keys(data).filter(k => !k.startsWith('_')));
        
        const aug9to15 = data['2025-08-09_to_2025-08-15'];
        if (aug9to15) {
            console.log('Aug 9-15 summary:', aug9to15.summary.substring(0, 100) + '...');
            
            if (aug9to15.summary.includes('Error: No GEMINI_API_KEY')) {
                console.log('❌ STILL HAS GEMINI ERROR!');
            } else {
                console.log('✅ Summary looks good!');
            }
        } else {
            console.log('❌ Aug 9-15 week not found');
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });