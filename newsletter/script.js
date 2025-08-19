// Newsletter Subscription Form JavaScript
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('newsletterForm');
    const submitBtn = document.getElementById('submitBtn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoading = submitBtn.querySelector('.btn-loading');
    const successMessage = document.getElementById('successMessage');
    const errorMessage = document.getElementById('errorMessage');
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Get form data
        const email = document.getElementById('email').value.trim();
        
        // Validate email
        if (!isValidEmail(email)) {
            showError('Please enter a valid email address');
            return;
        }
        
        // Show loading state
        setLoadingState(true);
        hideMessages();
        
        try {
            // Submit form
            const response = await fetch('/newsletter/subscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email: email })
            });
            
            if (response.ok) {
                showSuccess();
            } else {
                const errorData = await response.json();
                showError(errorData.message || 'Something went wrong. Please try again.');
            }
        } catch (error) {
            console.error('Subscription error:', error);
            showError('Network error. Please check your connection and try again.');
        } finally {
            setLoadingState(false);
        }
    });
    
    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    function setLoadingState(loading) {
        submitBtn.disabled = loading;
        if (loading) {
            btnText.style.display = 'none';
            btnLoading.style.display = 'inline-block';
        } else {
            btnText.style.display = 'inline-block';
            btnLoading.style.display = 'none';
        }
    }
    
    function showSuccess() {
        form.classList.add('fade-out');
        setTimeout(() => {
            form.style.display = 'none';
            successMessage.style.display = 'block';
            successMessage.classList.add('fade-in');
        }, 300);
    }
    
    function showError(message) {
        errorMessage.querySelector('p').textContent = message;
        errorMessage.style.display = 'block';
        errorMessage.classList.add('fade-in');
        
        // Hide error after 5 seconds
        setTimeout(() => {
            hideMessages();
        }, 5000);
    }
    
    function hideMessages() {
        successMessage.style.display = 'none';
        errorMessage.style.display = 'none';
        successMessage.classList.remove('fade-in');
        errorMessage.classList.remove('fade-in');
    }
    
    // Add some nice focus effects
    const emailInput = document.getElementById('email');
    emailInput.addEventListener('focus', function() {
        this.placeholder = 'your@email.com';
    });
    
    emailInput.addEventListener('blur', function() {
        this.placeholder = 'Enter your email address';
    });
});