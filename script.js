// Authentication Manager
class AuthManager {
    constructor() {
        this.auth = null;
        this.currentUser = null;
        this.init();
    }

    async init() {
        // Wait for Firebase to load
        while (!window.auth) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        this.auth = window.auth;
        this.setupAuthListeners();
        this.setupAuthUI();
        this.setupConnectionStatus();
    }

    setupAuthListeners() {
        window.onAuthStateChanged(this.auth, (user) => {
            this.currentUser = user;
            window.authManager = this; // Make auth manager globally available
            this.updateUI(user);
        });
    }

    setupAuthUI() {
        // Tab switching
        document.getElementById('loginTab').addEventListener('click', () => this.switchTab('login'));
        document.getElementById('signupTab').addEventListener('click', () => this.switchTab('signup'));
        
        // Form submissions
        document.getElementById('loginFormElement').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('signupFormElement').addEventListener('submit', (e) => this.handleSignup(e));
        
        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => this.handleLogout());
        
        // Resend verification
        document.getElementById('resendVerification').addEventListener('click', () => this.resendVerification());
    }

    switchTab(tab) {
        const loginTab = document.getElementById('loginTab');
        const signupTab = document.getElementById('signupTab');
        const loginForm = document.getElementById('loginForm');
        const signupForm = document.getElementById('signupForm');
        
        if (tab === 'login') {
            loginTab.classList.add('active');
            signupTab.classList.remove('active');
            loginForm.style.display = 'block';
            signupForm.style.display = 'none';
        } else {
            signupTab.classList.add('active');
            loginTab.classList.remove('active');
            signupForm.style.display = 'block';
            loginForm.style.display = 'none';
        }
        
        this.clearErrors();
    }

    async handleLogin(e) {
        e.preventDefault();
        this.clearErrors();
        
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        try {
            await window.signInWithEmailAndPassword(this.auth, email, password);
            // Success handled by auth state change
        } catch (error) {
            this.showError('loginError', this.getErrorMessage(error));
        }
    }

    async handleSignup(e) {
        e.preventDefault();
        this.clearErrors();
        
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        if (password !== confirmPassword) {
            this.showError('signupError', 'Passwords do not match');
            return;
        }
        
        if (password.length < 6) {
            this.showError('signupError', 'Password must be at least 6 characters');
            return;
        }
        
        try {
            const userCredential = await window.createUserWithEmailAndPassword(this.auth, email, password);
            await window.sendEmailVerification(userCredential.user);
            this.showVerificationMessage();
        } catch (error) {
            this.showError('signupError', this.getErrorMessage(error));
        }
    }

    async handleLogout() {
        try {
            await window.signOut(this.auth);
        } catch (error) {
            console.error('Logout error:', error);
        }
    }

    async resendVerification() {
        if (this.currentUser) {
            try {
                await window.sendEmailVerification(this.currentUser);
                alert('Verification email sent!');
            } catch (error) {
                console.error('Resend verification error:', error);
            }
        }
    }

    updateUI(user) {
        const authSection = document.getElementById('authSection');
        const mainApp = document.getElementById('mainApp');
        const userInfo = document.getElementById('userInfo');
        const userEmail = document.getElementById('userEmail');
        
        if (user) {
            // User is signed in
            authSection.style.display = 'none';
            mainApp.style.display = 'block';
            userInfo.style.display = 'flex';
            userEmail.textContent = user.email;
            
            // Initialize the bookshelf scanner
            if (!window.bookshelfScanner) {
                window.bookshelfScanner = new BookshelfScanner();
            }
        } else {
            // User is signed out
            authSection.style.display = 'block';
            mainApp.style.display = 'none';
            userInfo.style.display = 'none';
        }
    }

    showError(elementId, message) {
        const errorElement = document.getElementById(elementId);
        errorElement.textContent = message;
        errorElement.classList.add('show');
    }

    clearErrors() {
        document.getElementById('loginError').classList.remove('show');
        document.getElementById('signupError').classList.remove('show');
    }

    showVerificationMessage() {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('signupForm').style.display = 'none';
        document.getElementById('verificationMessage').style.display = 'block';
    }

    getErrorMessage(error) {
        switch (error.code) {
            case 'auth/user-not-found':
                return 'No account found with this email address';
            case 'auth/wrong-password':
                return 'Incorrect password';
            case 'auth/email-already-in-use':
                return 'An account with this email already exists';
            case 'auth/weak-password':
                return 'Password is too weak';
            case 'auth/invalid-email':
                return 'Invalid email address';
            case 'auth/too-many-requests':
                return 'Too many failed attempts. Please try again later';
            default:
                return error.message;
        }
    }
    
    setupConnectionStatus() {
        const statusIndicator = document.getElementById('statusIndicator');
        const statusText = document.getElementById('statusText');
        
        if (!statusIndicator || !statusText) return;
        
        // Monitor Firebase connection status
        if (window.db) {
            // Check connection status periodically
            setInterval(() => {
                this.updateConnectionStatus(statusIndicator, statusText);
            }, 5000);
            
            // Initial status check
            this.updateConnectionStatus(statusIndicator, statusText);
        }
    }
    
    updateConnectionStatus(statusIndicator, statusText) {
        if (!window.db) {
            statusIndicator.className = 'status-indicator offline';
            statusText.textContent = 'No Database';
            return;
        }
        
        // Try a simple Firestore operation to check connection
        const testDoc = window.doc(window.db, '_test', 'connection');
        window.getDoc(testDoc)
            .then(() => {
                statusIndicator.className = 'status-indicator online';
                statusText.textContent = 'Online';
            })
            .catch((error) => {
                if (error.message.includes('offline') || error.message.includes('unavailable')) {
                    statusIndicator.className = 'status-indicator offline';
                    statusText.textContent = 'Offline';
                } else {
                    statusIndicator.className = 'status-indicator syncing';
                    statusText.textContent = 'Syncing...';
                }
            });
    }
}

// Enhanced Bookshelf Scanner with Real-time Detection
class BookshelfScanner {
    constructor() {
        this.stream = null;
        this.currentPhotoData = null; // Store current photo for position tracking
        this.detectionActive = false;
        this.currentUser = null;
        this.library = [];
        
        // Clean up any existing photo data that might be causing storage issues
        this.cleanupExistingLibraryData();
        this.detectionInterval = null;
        this.detectedBooks = new Map();
        this.currentView = 'camera';
        
        this.initializeElements();
        this.bindEvents();
        this.setupDragAndDrop();
        
        // Wait for user to be set by auth manager
        this.waitForUser();
    }
    
    async waitForUser() {
        // Wait for auth manager to set the current user
        while (!window.authManager || !window.authManager.currentUser) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        this.currentUser = window.authManager.currentUser;
        await this.loadUserLibrary();
        this.updateLibraryDisplay();
    }
    
    async loadUserLibrary() {
        if (!this.currentUser || !window.db) {
            this.library = [];
            return;
        }
        
        try {
            const userDocRef = window.doc(window.db, 'users', this.currentUser.uid);
            const userDoc = await window.getDoc(userDocRef);
            
            if (userDoc.exists()) {
                const userData = userDoc.data();
                this.library = userData.library || [];
                console.log(`Loaded ${this.library.length} books from Firestore for user: ${this.currentUser.email}`);
            } else {
                // Create user document if it doesn't exist
                await window.setDoc(userDocRef, {
                    email: this.currentUser.email,
                    library: [],
                    createdAt: new Date().toISOString()
                });
                this.library = [];
                console.log(`Created new user document for: ${this.currentUser.email}`);
            }
        } catch (error) {
            console.error('Error loading user library from Firestore:', error);
            
            // Fallback to localStorage if Firestore is unavailable
            console.log('🔄 Falling back to localStorage...');
            const libraryKey = `user-${this.currentUser.uid}-library`;
            const storedLibrary = localStorage.getItem(libraryKey);
            
            if (storedLibrary) {
                this.library = JSON.parse(storedLibrary);
                console.log(`Loaded ${this.library.length} books from localStorage fallback`);
            } else {
                this.library = [];
                console.log('No library data found in localStorage either');
            }
            
            // Show user-friendly message about offline mode
            if (error.message.includes('offline') || error.message.includes('unavailable')) {
                console.log('📱 App is running in offline mode. Data will sync when connection is restored.');
            }
        }
    }
    
    cleanupExistingLibraryData() {
        // Remove any accidentally stored photo data from existing books
        let cleaned = false;
        this.library.forEach(book => {
            if (book.originalPhoto) {
                delete book.originalPhoto;
                cleaned = true;
                console.log(`Removed photo data from book: ${book.title}`);
            }
            // Remove any other large data fields that might exist
            if (book.photoData) {
                delete book.photoData;
                cleaned = true;
            }
        });
        
        if (cleaned) {
            console.log('Cleaned up existing library data to reduce storage size');
            try {
                localStorage.setItem('bookLibrary', JSON.stringify(this.library));
            } catch (error) {
                console.error('Still having storage issues after cleanup:', error);
            }
        }
    }

    showError(message) {
        // Display error message to user
        alert(message);
    }

    getHEICErrorMessage() {
        const isDeployed = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
        
        if (isDeployed) {
            return `
                📱 HEIC Conversion Failed
                
                We tried multiple conversion methods but couldn't convert this HEIC file.
                This sometimes happens with certain HEIC files or older browsers.
                
                🖼️  QUICK FIX: Take a screenshot instead
                • Press CMD+Shift+4 (Mac) or Windows+Shift+S (PC)
                • Select the area with your books
                • Upload the screenshot (works 100% of the time!)
                
                📱 OR: Convert in Photos app
                • Open Photos app → Select your photo
                • Share → Copy Photo (creates JPEG version)
                • Upload the copied photo
                
                💾 OR: Export as JPEG
                • Photos app → Select photo → File → Export
                • Choose JPEG format → Save
                • Upload the exported file
                
                Screenshots are the most reliable method! 📸
            `;
        } else {
            return `
                📱 HEIC Conversion Failed
                
                This HEIC file couldn't be converted to JPEG automatically.
                
                🖼️  EASIEST SOLUTION: Take a screenshot instead
                • Press CMD+Shift+4 (Mac) or Windows+Shift+S (PC)
                • Select the area with your books
                • Upload the screenshot (works 100% of the time!)
                
                📱 OR: Convert in Photos app
                • Open Photos app → Select your photo
                • Share → Copy Photo (creates JPEG version)
                • Upload the copied photo
                
                💾 OR: Export as JPEG
                • Photos app → Select photo → File → Export
                • Choose JPEG format → Save
                • Upload the exported file
                
                The screenshot method is the most reliable! 📸
            `;
        }
    }

    // Enhanced HEIC to JPEG conversion with multiple fallback methods
    async convertHEICToJPEG(file) {
        console.log('Converting HEIC to JPEG with enhanced methods...');
        
        // Method 1: Try heic2any with different options
        if (typeof heic2any !== 'undefined') {
            console.log('Trying enhanced heic2any conversion...');
            try {
                // Try different quality settings and formats
                const options = [
                    { toType: 'image/jpeg', quality: 0.9 },
                    { toType: 'image/jpeg', quality: 0.8 },
                    { toType: 'image/jpeg', quality: 0.7 },
                    { toType: 'image/png' }, // Sometimes PNG works when JPEG doesn't
                ];
                
                for (let i = 0; i < options.length; i++) {
                    try {
                        console.log(`Trying option ${i + 1}:`, options[i]);
                        const result = await heic2any({
                            blob: file,
                            ...options[i]
                        });
                        
                        const blob = Array.isArray(result) ? result[0] : result;
                        
                        // Convert to JPEG if it's PNG
                        if (options[i].toType === 'image/png') {
                            const jpegBlob = await this.convertPNGToJPEG(blob);
                            return await this.blobToDataURL(jpegBlob);
                        }
                        
                        return await this.blobToDataURL(blob);
                    } catch (optionError) {
                        console.log(`Option ${i + 1} failed:`, optionError.message);
                        if (i === options.length - 1) throw optionError;
                    }
                }
            } catch (heic2anyError) {
                console.log('All heic2any options failed:', heic2anyError.message);
            }
        }
        
        // Method 2: Try server-side conversion
        try {
            console.log('Trying server-side conversion...');
            const fileDataUrl = await this.fileToDataURL(file);
            
            const response = await fetch('/api/convert-heic', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    file: fileDataUrl
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    console.log('✅ Server-side HEIC conversion successful');
                    return result.jpegDataUrl;
                }
            }
        } catch (serverError) {
            console.log('Server-side conversion failed:', serverError.message);
        }
        
        // Method 3: Try to use the file as-is (sometimes works)
        try {
            console.log('Trying to use HEIC file as-is...');
            const dataUrl = await this.fileToDataURL(file);
            
            // Test if the browser can load it
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    console.log('✅ HEIC file loaded successfully as-is');
                    resolve(dataUrl);
                };
                img.onerror = () => {
                    reject(new Error('HEIC file cannot be loaded'));
                };
                img.src = dataUrl;
            });
        } catch (asIsError) {
            console.log('Using HEIC as-is failed:', asIsError.message);
        }
        
        // All methods failed
        throw new Error('All HEIC conversion methods failed');
    }

    // Helper method to convert PNG to JPEG
    async convertPNGToJPEG(pngBlob) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                canvas.width = img.width;
                canvas.height = img.height;
                
                // Fill with white background (PNG might have transparency)
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Draw the image
                ctx.drawImage(img, 0, 0);
                
                canvas.toBlob(resolve, 'image/jpeg', 0.9);
            };
            img.onerror = () => reject(new Error('Failed to load PNG'));
            img.src = URL.createObjectURL(pngBlob);
        });
    }

    // Helper method to convert blob to data URL
    blobToDataURL(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Failed to read blob'));
            reader.readAsDataURL(blob);
        });
    }

    // Helper method to convert file to data URL
    fileToDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }

    // Method 1: Try heic2any library (original method)
    async convertWithHeic2any(file) {
        if (typeof heic2any === 'undefined') {
            throw new Error('heic2any library not available');
        }
        
        console.log('Trying heic2any library...');
        const jpegBlob = await heic2any({
            blob: file,
            toType: 'image/jpeg',
            quality: 0.85
        });
        
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Failed to read converted JPEG'));
            reader.readAsDataURL(jpegBlob);
        });
    }

    // Method 2: Try server-side conversion (most reliable)
    async convertWithServerSide(file) {
        console.log('Trying server-side conversion...');
        
        // First, convert file to data URL
        const heicDataURL = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
        
        console.log('Sending HEIC data to server for conversion...');
        
        // Send to server for conversion
        const response = await fetch('/api/convert-heic', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                heicDataUrl: heicDataURL
            })
        });
        
        console.log('Server response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server error:', errorText);
            throw new Error(`Server error: ${response.status} - ${errorText}`);
        }
        
        const result = await response.json();
        console.log('Server conversion result:', result);
        
        if (result.success) {
            console.log('✅ Server-side conversion successful');
            return result.jpegDataUrl;
        } else {
            throw new Error(result.error || 'Server-side conversion failed');
        }
    }

    // Method 3: Try canvas conversion (if browser can load HEIC)
    async convertWithCanvas(file) {
        console.log('Trying canvas conversion...');
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    try {
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        
                        canvas.width = img.width;
                        canvas.height = img.height;
                        
                        ctx.drawImage(img, 0, 0);
                        const jpegDataURL = canvas.toDataURL('image/jpeg', 0.85);
                        resolve(jpegDataURL);
                    } catch (error) {
                        reject(new Error('Canvas conversion failed'));
                    }
                };
                img.onerror = () => reject(new Error('Browser cannot load HEIC image'));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }

    // Method 4: Try browser native handling
    async convertWithBrowserNative(file) {
        console.log('Trying browser native handling...');
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                // Some browsers can handle HEIC files directly
                const img = new Image();
                img.onload = () => {
                    console.log('Browser can handle HEIC file natively');
                    resolve(e.target.result);
                };
                img.onerror = () => reject(new Error('Browser cannot handle HEIC file'));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }

    // Method 5: Try heic-convert library
    async convertWithHeicConvert(file) {
        console.log('Trying heic-convert library...');
        if (typeof heicConvert === 'undefined') {
            throw new Error('heic-convert library not available');
        }
        
        try {
            const arrayBuffer = await file.arrayBuffer();
            const jpegBuffer = await heicConvert({
                buffer: arrayBuffer,
                format: 'JPEG',
                quality: 0.9
            });
            
            const blob = new Blob([jpegBuffer], { type: 'image/jpeg' });
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = () => reject(new Error('Failed to read converted JPEG'));
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            throw new Error('heic-convert conversion failed: ' + error.message);
        }
    }

    // Method 6: Try heic-js library
    async convertWithHeicJs(file) {
        console.log('Trying heic-js library...');
        if (typeof HEIC === 'undefined') {
            throw new Error('heic-js library not available');
        }
        
        try {
            const arrayBuffer = await file.arrayBuffer();
            const jpegBuffer = HEIC.decode(arrayBuffer);
            
            const blob = new Blob([jpegBuffer], { type: 'image/jpeg' });
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = () => reject(new Error('Failed to read converted JPEG'));
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            throw new Error('heic-js conversion failed: ' + error.message);
        }
    }

    // Method 7: Try alternative heic-convert with different CDN
    async convertWithHeicConvertAlt(file) {
        console.log('Trying alternative heic-convert library...');
        if (typeof heicConvert === 'undefined') {
            throw new Error('alternative heic-convert library not available');
        }
        
        try {
            const arrayBuffer = await file.arrayBuffer();
            const jpegBuffer = await heicConvert({
                buffer: arrayBuffer,
                format: 'JPEG',
                quality: 0.9
            });
            
            const blob = new Blob([jpegBuffer], { type: 'image/jpeg' });
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = () => reject(new Error('Failed to read converted JPEG'));
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            throw new Error('alternative heic-convert conversion failed: ' + error.message);
        }
    }

    // Method 8: Try to create a JPEG from HEIC using File API
    async convertWithFileAPI(file) {
        console.log('Trying File API conversion...');
        
        try {
            // Try to read the file as a blob and create a new JPEG blob
            const arrayBuffer = await file.arrayBuffer();
            
            // Create a new blob with JPEG MIME type
            const jpegBlob = new Blob([arrayBuffer], { type: 'image/jpeg' });
            
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    // Try to load it as an image to validate
                    const img = new Image();
                    img.onload = () => {
                        console.log('File API conversion successful');
                        resolve(e.target.result);
                    };
                    img.onerror = () => {
                        reject(new Error('File API conversion failed - invalid JPEG'));
                    };
                    img.src = e.target.result;
                };
                reader.onerror = () => reject(new Error('Failed to read file with File API'));
                reader.readAsDataURL(jpegBlob);
            });
        } catch (error) {
            throw new Error('File API conversion failed: ' + error.message);
        }
    }

    initializeElements() {
        // Tab elements
        this.cameraTab = document.getElementById('cameraTab');
        this.photoTab = document.getElementById('photoTab');
        this.cameraView = document.getElementById('cameraView');
        this.photoView = document.getElementById('photoView');

        // Camera elements
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.startCameraBtn = document.getElementById('startCamera');
        this.toggleDetectionBtn = document.getElementById('toggleDetection');
        this.stopCameraBtn = document.getElementById('stopCamera');
        this.detectionOverlay = document.getElementById('detectionOverlay');

        // Photo upload elements
        this.photoInput = document.getElementById('photoInput');
        this.uploadArea = document.getElementById('uploadArea');
        this.uploadedImageContainer = document.getElementById('uploadedImageContainer');
        this.uploadedImage = document.getElementById('uploadedImage');
        this.imageOverlay = document.getElementById('imageOverlay');
        this.photoControls = document.getElementById('photoControls');
        this.analyzePhotoBtn = document.getElementById('analyzePhoto');
        this.clearPhotoBtn = document.getElementById('clearPhoto');

        // Processing elements
        this.processingSection = document.querySelector('.processing-section');
        this.capturedImage = document.getElementById('capturedImage');
        this.processingText = document.getElementById('processingText');

        // Results elements
        this.bookDetails = document.getElementById('bookDetails');
        this.extractedText = document.getElementById('extractedText');
        this.ocrResult = document.getElementById('ocrResult');
        this.searchBooksBtn = document.getElementById('searchBooks');

        // Library elements
        this.libraryGrid = document.getElementById('libraryGrid');
        this.bookCount = document.getElementById('bookCount');
        this.librarySearch = document.getElementById('librarySearch');
        this.exportLibraryBtn = document.getElementById('exportLibrary');
        this.clearLibraryBtn = document.getElementById('clearLibrary');

        // Navigation elements
        this.scannerTab = document.getElementById('scannerTab');
        this.libraryTab = document.getElementById('libraryTab');
        this.photosTab = document.getElementById('photosTab');
        this.scannerSection = document.getElementById('scannerSection');
        this.librarySection = document.getElementById('librarySection');
        this.photosSection = document.getElementById('photosSection');

        // Photos elements
        this.photosGrid = document.getElementById('photosGrid');
        this.photoCount = document.getElementById('photoCount');
    }

    bindEvents() {
        // Tab switching
        this.cameraTab.addEventListener('click', () => this.switchToCamera());
        this.photoTab.addEventListener('click', () => this.switchToPhoto());

        // Camera controls
        this.startCameraBtn.addEventListener('click', () => this.startCamera());
        this.toggleDetectionBtn.addEventListener('click', () => this.toggleDetection());
        this.stopCameraBtn.addEventListener('click', () => this.stopCamera());

        // Photo upload
        this.photoInput.addEventListener('change', (e) => this.handlePhotoUpload(e));
        
        // Prevent duplicate click listeners
        if (!this.uploadArea.hasAttribute('data-click-setup')) {
            this.uploadArea.setAttribute('data-click-setup', 'true');
            this.uploadArea.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Prevent rapid successive clicks
                if (this.uploadArea.hasAttribute('data-clicking')) {
                    return;
                }
                this.uploadArea.setAttribute('data-clicking', 'true');
                
                setTimeout(() => {
                    this.uploadArea.removeAttribute('data-clicking');
                }, 100);
                
                this.photoInput.click();
            });
        }
        
        this.analyzePhotoBtn.addEventListener('click', () => this.analyzeUploadedPhoto());
        this.clearPhotoBtn.addEventListener('click', () => this.clearUploadedPhoto());

        // Library controls
        this.librarySearch.addEventListener('input', (e) => this.filterLibrary(e.target.value));
        this.exportLibraryBtn.addEventListener('click', () => this.exportLibrary());
        this.clearLibraryBtn.addEventListener('click', () => this.clearLibrary());

        // Navigation controls
        this.scannerTab.addEventListener('click', () => this.switchToSection('scanner'));
        this.libraryTab.addEventListener('click', () => this.switchToSection('library'));
        this.photosTab.addEventListener('click', () => this.switchToSection('photos'));

        // Search functionality
        this.searchBooksBtn.addEventListener('click', () => this.searchForBook());
        
        // Add test button for debugging (temporary)
        const testBtn = document.createElement('button');
        testBtn.textContent = 'Test JPEG Conversion';
        testBtn.style.cssText = 'position:fixed;top:10px;right:10px;z-index:9999;background:red;color:white;padding:10px;';
        testBtn.onclick = () => this.testJPEGConversion();
        document.body.appendChild(testBtn);
    }

    switchToCamera() {
        this.currentView = 'camera';
        this.cameraTab.classList.add('active');
        this.photoTab.classList.remove('active');
        this.cameraView.style.display = 'block';
        this.photoView.style.display = 'none';
        this.hideResults();
    }

    switchToPhoto() {
        this.currentView = 'photo';
        this.photoTab.classList.add('active');
        this.cameraTab.classList.remove('active');
        this.photoView.style.display = 'block';
        this.cameraView.style.display = 'none';
        this.hideResults();
        
        // Stop camera if running
        if (this.stream) {
            this.stopCamera();
        }
    }

    setupDragAndDrop() {
        // Prevent adding duplicate event listeners
        if (this.uploadArea.hasAttribute('data-drag-setup')) {
            return;
        }
        this.uploadArea.setAttribute('data-drag-setup', 'true');

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            this.uploadArea.addEventListener(eventName, this.preventDefaults, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            this.uploadArea.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.uploadArea.classList.add('dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            this.uploadArea.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.uploadArea.classList.remove('dragover');
            }, false);
        });

        this.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type.startsWith('image/')) {
                this.processUploadedFile(files[0]);
            }
        }, false);
    }

    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    async startCamera() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    facingMode: 'environment',
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            });
            
            this.video.srcObject = this.stream;
            this.startCameraBtn.disabled = true;
            this.toggleDetectionBtn.disabled = false;
            this.stopCameraBtn.disabled = false;
            
            console.log('Camera started successfully');
        } catch (error) {
            console.error('Error accessing camera:', error);
            alert('Unable to access camera. Please ensure you have granted camera permissions.');
        }
    }

    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        this.stopDetection();
        this.video.srcObject = null;
        this.startCameraBtn.disabled = false;
        this.toggleDetectionBtn.disabled = true;
        this.stopCameraBtn.disabled = true;
        this.clearDetectionOverlay();
        
        console.log('Camera stopped');
    }

    toggleDetection() {
        if (this.detectionActive) {
            this.stopDetection();
        } else {
            this.startDetection();
        }
    }

    startDetection() {
        this.detectionActive = true;
        this.toggleDetectionBtn.textContent = '⏸️ Stop Detection';
        this.toggleDetectionBtn.classList.remove('btn-secondary');
        this.toggleDetectionBtn.classList.add('btn-danger');
        
        // Run detection every 3 seconds to avoid overwhelming the APIs
        this.detectionInterval = setInterval(() => {
            this.performRealtimeDetection();
        }, 3000);
        
        // Run first detection immediately
        this.performRealtimeDetection();
    }

    stopDetection() {
        this.detectionActive = false;
        this.toggleDetectionBtn.innerHTML = '<span class="icon">🔍</span> Start Detection';
        this.toggleDetectionBtn.classList.remove('btn-danger');
        this.toggleDetectionBtn.classList.add('btn-secondary');
        
        if (this.detectionInterval) {
            clearInterval(this.detectionInterval);
            this.detectionInterval = null;
        }
    }

    async performRealtimeDetection() {
        if (!this.detectionActive || !this.video.videoWidth) return;

        try {
            // Capture current frame
            const context = this.canvas.getContext('2d');
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;
            context.drawImage(this.video, 0, 0);
            
            const imageDataURL = this.canvas.toDataURL('image/jpeg', 0.7);
            
            // Perform OCR on the frame
            const { data: { text } } = await Tesseract.recognize(imageDataURL, 'eng');
            
            const extractedText = text.trim();
            if (extractedText.length > 10) {
                await this.processDetectedText(extractedText, result.data);
            }
            
        } catch (error) {
            console.error('Real-time detection error:', error);
        }
    }

    async processDetectedText(text, ocrData) {
        // Extract potential book titles from OCR data
        const potentialTitles = this.extractBookTitles(text, ocrData);
        
        for (const titleInfo of potentialTitles) {
            // Skip if we've already detected this book recently
            if (this.detectedBooks.has(titleInfo.text)) {
                continue;
            }
            
            try {
                const bookData = await this.searchForBookQuick(titleInfo.text);
                if (bookData) {
                    this.detectedBooks.set(titleInfo.text, {
                        book: bookData,
                        position: titleInfo.bbox,
                        timestamp: Date.now()
                    });
                    
                    this.displayDetectedBook(bookData, titleInfo.bbox);
                }
            } catch (error) {
                console.error('Error searching for book:', titleInfo.text, error);
            }
        }
        
        // Clean up old detections (older than 10 seconds)
        this.cleanupOldDetections();
    }

    extractBookTitles(text, ocrData) {
        const lines = text.split(/[\n\r]+/).filter(line => line.trim().length > 2);
        const titles = [];
        
        console.log('All text lines:', lines);
        
        // Look for lines that could be book titles
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Skip lines that are too short, contain mostly numbers, or are common non-title words
            if (line.length < 3 || 
                /^\d+$/.test(line) || 
                /^[^\w\s]*$/.test(line) ||
                ['THE', 'AND', 'OR', 'BUT', 'IN', 'ON', 'AT', 'TO', 'FOR', 'OF', 'WITH', 'BY'].includes(line.toUpperCase())) {
                continue;
            }
            
            // Look for title-like patterns or just include any reasonable text
            if (this.looksLikeBookTitle(line)) {
                // Try to find bounding box for this text
                const bbox = this.findTextBoundingBox(line, ocrData);
                titles.push({
                    text: line,
                    bbox: bbox
                });
            }
        }
        
        // If no titles found with strict criteria, be more lenient
        if (titles.length === 0) {
            console.log('No strict titles found, being more lenient...');
            for (let i = 0; i < Math.min(lines.length, 15); i++) {
                const line = lines[i].trim();
                if (line.length >= 3 && line.length <= 100 && !/^\d+$/.test(line)) {
                    const bbox = this.findTextBoundingBox(line, ocrData);
                    titles.push({
                        text: line,
                        bbox: bbox
                    });
                }
            }
        }
        
        console.log('Extracted potential titles:', titles);
        return titles.slice(0, 8); // Limit to 8 potential titles
    }

    looksLikeBookTitle(text) {
        // Simple heuristics for book titles
        const titlePatterns = [
            /^[A-Z][a-z].*[A-Z]/,  // Starts with capital, has another capital
            /^The\s+\w+/i,         // Starts with "The"
            /^A\s+\w+/i,           // Starts with "A"
            /^[A-Z][a-z]+\s+[A-Z][a-z]+/, // Two capitalized words
        ];
        
        return titlePatterns.some(pattern => pattern.test(text)) && 
               text.length >= 4 && 
               text.length <= 50 &&
               !/^\d+$/.test(text); // Not just numbers
    }

    findTextBoundingBox(text, ocrData) {
        // This is a simplified version - in a real implementation,
        // you'd match the text with OCR word data to get precise coordinates
        const videoRect = this.video.getBoundingClientRect();
        const scaleX = videoRect.width / this.video.videoWidth;
        const scaleY = videoRect.height / this.video.videoHeight;
        
        // Return a placeholder bounding box (you'd calculate this from OCR data)
        return {
            left: Math.random() * 0.7 * videoRect.width,
            top: Math.random() * 0.7 * videoRect.height,
            width: 200 * scaleX,
            height: 30 * scaleY
        };
    }

    displayDetectedBook(bookData, bbox) {
        const detection = document.createElement('div');
        detection.className = 'book-detection';
        detection.style.left = bbox.left + 'px';
        detection.style.top = bbox.top + 'px';
        detection.style.width = bbox.width + 'px';
        detection.style.height = bbox.height + 'px';
        
        const label = document.createElement('div');
        label.className = 'book-label';
        label.textContent = bookData.title;
        detection.appendChild(label);
        
        // Add click handler to add to library
        detection.addEventListener('click', () => {
            this.addBookToLibrary(bookData);
        });
        
        this.detectionOverlay.appendChild(detection);
        
        // Remove after 5 seconds
        setTimeout(() => {
            if (detection.parentNode) {
                detection.parentNode.removeChild(detection);
            }
        }, 5000);
    }

    cleanupOldDetections() {
        const now = Date.now();
        for (const [key, value] of this.detectedBooks.entries()) {
            if (now - value.timestamp > 10000) { // 10 seconds
                this.detectedBooks.delete(key);
            }
        }
    }

    clearDetectionOverlay() {
        this.detectionOverlay.innerHTML = '';
        this.detectedBooks.clear();
    }

    handlePhotoUpload(event) {
        const file = event.target.files[0];
        if (file && file.type.startsWith('image/')) {
            this.processUploadedFile(file);
        }
    }

    async processUploadedFile(file) {
        // Store the original file for later use
        this.originalFile = file;
        
        try {
            // Convert to JPEG immediately when uploading
            console.log('Converting uploaded file to JPEG...');
            const jpegDataURL = await this.convertFileToJPEG(file);
            
            // Store the JPEG version for later use
            this.processedImageDataURL = jpegDataURL;
            
            // Display the image
            console.log('Setting image source to:', jpegDataURL.substring(0, 100) + '...');
            this.uploadedImage.src = jpegDataURL;
            this.uploadArea.style.display = 'none';
            this.uploadedImageContainer.style.display = 'block';
            this.photoControls.style.display = 'flex';
            
            // Store current photo data for position tracking
            this.currentPhotoData = {
                dataURL: jpegDataURL,
                uploadDate: new Date().toISOString(),
                fileName: this.originalFile?.name || 'uploaded_photo'
            };
            
            console.log('File successfully converted and displayed');
        } catch (error) {
            console.error('Error processing file:', error);
            
            // Check if it's a HEIC format message
            if (error.message.includes('HEIC Format Detected') || error.message.includes('HEIC Conversion Failed') || 
                error.message.includes('HEIC File Not Supported')) {
                this.showError(error.message);
                return;
            }
            
            // Fallback to original file for other errors (only if it's not HEIC)
            if (file.type === 'image/heic' || file.type === 'image/heif' || 
                file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
                console.error('HEIC file conversion failed and fallback not possible for HEIC files');
                this.showError(this.getHEICErrorMessage());
                return;
            }
            
            console.log('Using fallback processing for non-HEIC file...');
            const reader = new FileReader();
            reader.onload = (e) => {
                console.log('Fallback image loaded successfully');
                this.uploadedImage.src = e.target.result;
                this.processedImageDataURL = e.target.result;
                this.uploadArea.style.display = 'none';
                this.uploadedImageContainer.style.display = 'block';
                this.photoControls.style.display = 'flex';
            };
            reader.readAsDataURL(file);
        }
    }
    
    async convertFileToJPEG(file) {
        console.log('Converting file:', file.name, 'Type:', file.type);
        
            // Handle HEIC files specially - convert them automatically
            if (file.type === 'image/heic' || file.type === 'image/heif' || 
                file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
                console.log('HEIC file detected, attempting conversion to JPEG...');
                
                // Simple, reliable HEIC conversion
                try {
                    const result = await this.convertHEICToJPEG(file);
                    console.log('✅ HEIC conversion successful');
                    return result;
                } catch (error) {
                    console.error('❌ HEIC conversion failed:', error);
                    throw new Error(this.getHEICErrorMessage());
                }
            }
        
        // For non-HEIC files, process normally
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    try {
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        
                        // Resize if too large
                        const maxSize = 2048;
                        let width = img.width;
                        let height = img.height;
                        
                        if (width > maxSize || height > maxSize) {
                            const ratio = Math.min(maxSize / width, maxSize / height);
                            width = Math.round(width * ratio);
                            height = Math.round(height * ratio);
                        }
                        
                        canvas.width = width;
                        canvas.height = height;
                        ctx.drawImage(img, 0, 0, width, height);
                        
                        const jpegDataURL = canvas.toDataURL('image/jpeg', 0.85);
                        console.log('Generated JPEG data URL:', jpegDataURL.substring(0, 50) + '...');
                        console.log('JPEG data URL length:', jpegDataURL.length);
                        resolve(jpegDataURL);
                    } catch (error) {
                        reject(error);
                    }
                };
                img.onerror = () => reject(new Error('Failed to load image for conversion'));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }

    clearUploadedPhoto() {
        this.uploadedImage.src = '';
        this.originalFile = null;
        this.processedImageDataURL = null;
        this.uploadArea.style.display = 'block';
        this.uploadedImageContainer.style.display = 'none';
        this.photoControls.style.display = 'none';
        this.imageOverlay.innerHTML = '';
        this.photoInput.value = '';
        this.hideResults();
    }

    async analyzeUploadedPhoto() {
        if (!this.uploadedImage.src) return;
        
        this.showProcessing('Analyzing bookshelf with AI vision...');
        
        try {
            console.log('Starting sectioned AI vision analysis...');
            
            // Use the pre-processed JPEG if available, otherwise use the displayed image
            let imageDataURL = this.processedImageDataURL;
            
            if (!imageDataURL) {
                console.log('No pre-processed image, using displayed image source');
                imageDataURL = this.uploadedImage.src;
            }
            
            // Validate the image data URL
            if (!imageDataURL || !imageDataURL.startsWith('data:image/')) {
                throw new Error('Invalid image data URL for analysis');
            }
            
            console.log('🔍 Starting balanced fast and accurate scanning...');
            console.log('Image data URL length:', imageDataURL.length);
            console.log('Image data URL preview:', imageDataURL.substring(0, 100) + '...');
            
                // Improved scan: 5x4 = 20 sections with overlap for better accuracy
                const scanResults = await this.performScanPass(imageDataURL, 5, 4, 'High-Accuracy-Overlap');
            
            // Process books with confidence levels
            const processedBooks = this.processBooksWithConfidence(scanResults.books);
            const filteredTitles = this.filterNonBooks(processedBooks);
            const validatedTitles = this.validateBookTitles(filteredTitles);
            const uniqueTitles = this.removeDuplicateBooks(validatedTitles);
            
            console.log(`🎯 Smart scan complete: ${scanResults.successful}/${scanResults.total} sections successful, ${scanResults.failed} failed`);
            console.log(`📚 Found ${scanResults.books.length} total titles, ${filteredTitles.length} after filtering, ${uniqueTitles.length} unique`);
            
            // Log confidence breakdown
            const confidenceBreakdown = uniqueTitles.reduce((acc, book) => {
                const conf = book.confidence || 'medium';
                acc[conf] = (acc[conf] || 0) + 1;
                return acc;
            }, {});
            console.log('📊 Final confidence breakdown:', confidenceBreakdown);
            
            if (uniqueTitles && uniqueTitles.length > 0) {
                // Process detected books directly without visual overlays for speed
                await this.processAIDetectedBooks(uniqueTitles);
            } else {
                this.hideProcessing();
                alert('AI could not detect any book titles in this image. Try a clearer photo with visible book spines.');
            }
            
        } catch (error) {
            console.error('AI analysis error:', error);
            console.error('Error details:', error.message);
            this.hideProcessing();
            
            if (error.message.includes('401') || error.message.includes('authentication')) {
                alert('Invalid API key. Please check your OpenAI API key and try again.');
            } else if (error.message.includes('CORS') || error.message.includes('cors')) {
                alert('CORS error: Direct API calls from browser are blocked. We need a proxy server for this to work.');
            } else {
                alert(`Error analyzing photo with AI: ${error.message}\n\nCheck the browser console for more details.`);
            }
        }
    }



    async performScanPass(imageDataURL, sectionsX, sectionsY, passName) {
        this.processingText.textContent = `Scanning Books...`;
        
        const sectionsData = await this.createImageSectionsCustom(imageDataURL, sectionsX, sectionsY);
        console.log(`${passName} pass: Created ${sectionsData.sections.length} sections`);
        
        let passBookTitles = [];
        let successfulSections = 0;
        let failedSections = 0;
        
        // Analyze each section in this pass
        for (let i = 0; i < sectionsData.sections.length; i++) {
            this.processingText.textContent = `Scanning Books - Section ${i + 1}/${sectionsData.sections.length}`;
            
            try {
                const sectionBooks = await this.analyzeWithOpenAIWithRetry(sectionsData.sections[i], `${passName} section ${i + 1}`, 3);
                if (sectionBooks && sectionBooks.length > 0) {
                    // Add books directly without position tracking for speed
                    passBookTitles = passBookTitles.concat(sectionBooks);
                    console.log(`${passName} section ${i + 1} found:`, sectionBooks.map(b => b.title));
                }
                successfulSections++;
            } catch (sectionError) {
                console.warn(`${passName} section ${i + 1} analysis failed:`, sectionError.message);
                failedSections++;
            }
            
            // Balanced delay - optimized for 12 sections
            if (i < sectionsData.sections.length - 1) {
                const delay = 1000; // 1.0 seconds - balanced for 12 sections
                this.processingText.textContent = `Scanning Books - Section ${i + 1}/${sectionsData.sections.length} (waiting...)`;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        console.log(`${passName} pass complete: ${successfulSections}/${sectionsData.sections.length} sections successful`);
        
        return {
            books: passBookTitles,
            successful: successfulSections,
            failed: failedSections,
            total: sectionsData.sections.length
        };
    }

    async createImageSectionsCustom(imageDataURL, sectionsX, sectionsY) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                const overlap = 0.5; // 50% overlap for complete coverage
                
                const sectionWidth = Math.floor(img.width / sectionsX);
                const sectionHeight = Math.floor(img.height / sectionsY);
                const overlapX = Math.floor(sectionWidth * overlap);
                const overlapY = Math.floor(sectionHeight * overlap);
                
                const sections = [];
                
                for (let row = 0; row < sectionsY; row++) {
                    for (let col = 0; col < sectionsX; col++) {
                        const startX = Math.max(0, col * sectionWidth - overlapX);
                        const startY = Math.max(0, row * sectionHeight - overlapY);
                        const endX = Math.min(img.width, (col + 1) * sectionWidth + overlapX);
                        const endY = Math.min(img.height, (row + 1) * sectionHeight + overlapY);
                        
                        const actualWidth = endX - startX;
                        const actualHeight = endY - startY;
                        
                        canvas.width = actualWidth;
                        canvas.height = actualHeight;
                        
                        ctx.drawImage(img, startX, startY, actualWidth, actualHeight, 0, 0, actualWidth, actualHeight);
                        
                        const sectionDataURL = canvas.toDataURL('image/jpeg', 0.85);
                        sections.push(sectionDataURL);
                    }
                }
                
                resolve({
                    sections: sections,
                    sectionsX: sectionsX,
                    sectionsY: sectionsY
                });
            };
            
            img.onerror = (error) => {
                console.error('Image loading error:', error);
                console.error('Image data URL length:', imageDataURL.length);
                console.error('Image data URL preview:', imageDataURL.substring(0, 200) + '...');
                reject(new Error('Failed to load image for sectioning'));
            };
            img.src = imageDataURL;
        });
    }

    async createImageSections(imageDataURL) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Set up grid parameters for detailed scanning
                // Reduced from 6x4 to 4x3 to avoid rate limits while still being thorough
                const sectionsX = 4; // 4 columns (was 6)
                const sectionsY = 3; // 3 rows (was 4) 
                const overlap = 0.2; // 20% overlap
                
                const sectionWidth = Math.floor(img.width / sectionsX);
                const sectionHeight = Math.floor(img.height / sectionsY);
                const overlapX = Math.floor(sectionWidth * overlap);
                const overlapY = Math.floor(sectionHeight * overlap);
                
                const sections = [];
                
                for (let row = 0; row < sectionsY; row++) {
                    for (let col = 0; col < sectionsX; col++) {
                        // Calculate section coordinates with overlap
                        const startX = Math.max(0, col * sectionWidth - overlapX);
                        const startY = Math.max(0, row * sectionHeight - overlapY);
                        const endX = Math.min(img.width, (col + 1) * sectionWidth + overlapX);
                        const endY = Math.min(img.height, (row + 1) * sectionHeight + overlapY);
                        
                        const actualWidth = endX - startX;
                        const actualHeight = endY - startY;
                        
                        // Skip sections that are too small
                        if (actualWidth < 100 || actualHeight < 100) continue;
                        
                        // Create canvas for this section
                        canvas.width = actualWidth;
                        canvas.height = actualHeight;
                        
                        // Clear and draw the section
                        ctx.clearRect(0, 0, actualWidth, actualHeight);
                        ctx.drawImage(img, startX, startY, actualWidth, actualHeight, 0, 0, actualWidth, actualHeight);
                        
                        // Convert to data URL
                        const sectionDataURL = canvas.toDataURL('image/jpeg', 0.85);
                        sections.push(sectionDataURL);
                        
                        console.log(`Created section ${sections.length}: ${actualWidth}x${actualHeight} from (${startX},${startY})`);
                    }
                }
                
                resolve({
                    sections: sections,
                    sectionsX: sectionsX,
                    sectionsY: sectionsY
                });
            };
            
            img.onerror = (error) => {
                console.error('Image loading error:', error);
                console.error('Image data URL length:', imageDataURL.length);
                console.error('Image data URL preview:', imageDataURL.substring(0, 200) + '...');
                reject(new Error('Failed to load image for sectioning'));
            };
            img.src = imageDataURL;
        });
    }

    filterNonBooks(bookTitles) {
        if (!bookTitles || bookTitles.length === 0) return [];
        
        // Common non-book items and author name patterns to filter out
        const nonBookPatterns = [
            // Board games and media
            /^connect\s*4$/i,
            /^pentago$/i,
            /^ticket\s*to\s*ride$/i,
            /^monopoly$/i,
            /^scrabble$/i,
            /^chess$/i,
            /^dvd$/i,
            /^cd$/i,
            /^blu[\-\s]*ray$/i,
            /^game$/i,
            /^board\s*game$/i,
            
            // Simple patterns
            /^\d+$/,  // Just numbers
            /^[a-z]$/i,  // Single letters
            
            // Only very obvious author patterns - be conservative
            /^[A-Z]\.\s*[A-Z]\.\s*[A-Z][a-z]+$/,  // "J. K. Rowling" format
            /^by\s+[A-Z]/i,  // "by Author Name" format
            
            // Publisher patterns
            /^penguin\s*(classics?)?$/i,
            /^random\s*house$/i,
            /^bantam$/i,
            /^vintage$/i,
            /^harper\s*(collins?)?$/i,
            
            // Common single author surnames that might be confused as titles
            /^shakespeare$/i,
            /^dickens$/i,
            /^austen$/i,
            /^tolkien$/i,
            /^hemingway$/i,
            /^steinbeck$/i,
        ];
        
        return bookTitles.filter(bookItem => {
            const title = typeof bookItem === 'string' ? bookItem : bookItem.title;
            if (!title || typeof title !== 'string') return false;
            
            const cleanTitle = title.trim().toLowerCase();
            if (cleanTitle.length < 2) return false;
            
            // Check against non-book patterns
            for (const pattern of nonBookPatterns) {
                if (pattern.test(cleanTitle)) {
                    console.log(`🚫 Filtered out non-book: "${title}"`);
                    return false;
                }
            }
            
            // Additional check for likely author names (common patterns)
            if (this.isLikelyAuthorName(cleanTitle)) {
                console.log(`🚫 Filtered out likely author name: "${title}"`);
                return false;
            }
            
            return true;
        });
    }

    isLikelyAuthorName(title) {
        // More conservative check - only flag obvious author patterns
        const words = title.split(/\s+/);
        
        // Check for obvious author indicators
        if (title.toLowerCase().startsWith('by ')) return true;
        if (title.toLowerCase().includes(' by ')) return true;
        
        // Single word names - only flag if very short and common surnames
        if (words.length === 1) {
            const commonAuthorSurnames = ['king', 'smith', 'brown', 'jones', 'miller', 'davis', 'garcia', 'rodriguez', 'wilson', 'martinez', 'anderson', 'taylor', 'thomas', 'hernandez', 'moore', 'martin', 'jackson', 'thompson', 'white', 'lopez', 'lee', 'gonzalez', 'harris', 'clark', 'lewis', 'robinson', 'walker', 'perez', 'hall', 'young'];
            return commonAuthorSurnames.includes(words[0].toLowerCase()) && words[0].length <= 8;
        }
        
        // Two words - be EXTREMELY conservative, only flag very obvious author names
        if (words.length === 2) {
            const [first, last] = words;
            // Only flag if both are very common first names AND common surnames
            const veryCommonFirstNames = ['John', 'Mary', 'James', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas'];
            const veryCommonLastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
            return veryCommonFirstNames.includes(first) && veryCommonLastNames.includes(last);
        }
        
        // Three words - only flag if it has initials (likely "J. R. R. Tolkien" format)
        if (words.length === 3) {
            const hasInitials = words.some(word => /^[A-Z]\.$/.test(word));
            return hasInitials;
        }
        
        return false;
    }

    processBooksWithConfidence(books) {
        if (!books || books.length === 0) return [];
        
        const processedBooks = [];
        
        for (const book of books) {
            // Handle both old format (string) and new format (object with confidence)
            if (typeof book === 'string') {
                // Old format - assume medium confidence
                processedBooks.push({
                    title: book,
                    confidence: 'medium'
                });
            } else if (book.title && book.confidence) {
                // New format with confidence
                processedBooks.push({
                    title: book.title,
                    confidence: book.confidence
                });
            } else if (book.title) {
                // Object with title but no confidence
                processedBooks.push({
                    title: book.title,
                    confidence: 'medium'
                });
            }
        }
        
        // Log confidence distribution
        const confidenceCounts = processedBooks.reduce((acc, book) => {
            acc[book.confidence] = (acc[book.confidence] || 0) + 1;
            return acc;
        }, {});
        
        console.log('📊 Confidence distribution:', confidenceCounts);
        
        return processedBooks;
    }

    validateBookTitles(books) {
        if (!books || books.length === 0) return [];
        
        // Patterns that indicate hallucinated or fake titles
        const suspiciousPatterns = [
            // Government/official document patterns
            /census\s+of\s+population/i,
            /united\s+states\s+summary/i,
            /population\s+and\s+housing/i,
            /characteristics/i,
            /federal\s+register/i,
            /government\s+publication/i,
            
            // Overly specific academic patterns
            /\d{4}:\s*[A-Z][a-z]+\s+Summary/i,
            /Summary\s+[A-Z][a-z]+\s+Characteristics/i,
            
            // Very long, formal titles that are unlikely to be on spines
            /^.{50,}$/, // Titles longer than 50 characters
            
            // ISBN patterns (shouldn't be book titles)
            /^\d{10,13}$/,
            /978\d{10}/,
            
            // Generic patterns
            /unknown\s+author/i,
            /no\s+title/i,
            /untitled/i,
            /book\s+\d+$/i,
            /volume\s+\d+$/i,
            /chapter\s+\d+$/i
        ];
        
        return books.filter(book => {
            const title = book.title || '';
            const confidence = book.confidence || 'medium';
            
            // Check for suspicious patterns
            const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(title));
            
            if (isSuspicious) {
                console.log(`🚫 Filtered suspicious title: "${title}" (${confidence})`);
                return false;
            }
            
            // Additional checks based on confidence
            if (title.length < 2) return false; // Too short
            if (title.length > 100) return false; // Too long
            if (/^\d+$/.test(title)) return false; // Just numbers
            
            // More lenient filtering for high confidence titles
            if (confidence === 'high') {
                // High confidence titles get more lenient treatment
                return true;
            } else if (confidence === 'medium') {
                // Medium confidence - standard filtering
                return true;
            } else if (confidence === 'low') {
                // Low confidence - stricter filtering
                if (title.length < 5) return false; // Must be longer
                if (title.length > 50) return false; // Must be shorter
                // Additional checks for low confidence
                if (/^(the|a|an)\s/i.test(title) && title.length < 10) return false;
            }
            
            return true;
        });
    }

    removeDuplicateBooks(bookTitles) {
        if (!bookTitles || bookTitles.length === 0) return [];
        
        const uniqueTitles = [];
        const seenTitles = new Set();
        
        for (const bookItem of bookTitles) {
            const title = typeof bookItem === 'string' ? bookItem : bookItem.title;
            if (!title || typeof title !== 'string') continue;
            
            const cleanTitle = title.trim().toLowerCase();
            if (cleanTitle.length < 2) continue;
            
            // Check for exact matches and very similar titles
            let isDuplicate = false;
            for (const seen of seenTitles) {
                if (this.areTitlesSimilar(cleanTitle, seen)) {
                    isDuplicate = true;
                    break;
                }
            }
            
            if (!isDuplicate) {
                seenTitles.add(cleanTitle);
                uniqueTitles.push(bookItem);
            }
        }
        
        return uniqueTitles;
    }

    areTitlesSimilar(title1, title2) {
        // Exact match
        if (title1 === title2) return true;
        
        // One is contained in the other (for partial titles)
        if (title1.includes(title2) || title2.includes(title1)) return true;
        
        // Simple edit distance for very similar titles
        const distance = this.levenshteinDistance(title1, title2);
        const maxLength = Math.max(title1.length, title2.length);
        const similarity = 1 - (distance / maxLength);
        
        return similarity > 0.8; // 80% similarity threshold
    }

    levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    adjustBookPositions(sectionBooks, sectionIndex, sectionsX, sectionsY) {
        // Convert section-relative positions to full image positions
        const row = Math.floor(sectionIndex / sectionsX);
        const col = sectionIndex % sectionsX;
        
        const sectionWidthPercent = 100 / sectionsX;
        const sectionHeightPercent = 100 / sectionsY;
        
        return sectionBooks.map(book => {
            // Skip books without position data
            if (book.x === undefined || book.y === undefined || book.x === null || book.y === null || 
                isNaN(book.x) || isNaN(book.y)) {
                console.log(`Skipping book "${book.title}" - invalid position data (x: ${book.x}, y: ${book.y})`);
                return book; // Return book without position adjustment
            }
            
            const adjustedBook = {
                ...book,
                x: col * sectionWidthPercent + (book.x * sectionWidthPercent / 100),
                y: row * sectionHeightPercent + (book.y * sectionHeightPercent / 100),
                width: (book.width || 10) * sectionWidthPercent / 100,
                height: (book.height || 15) * sectionHeightPercent / 100,
                sectionIndex: sectionIndex,
                originalX: book.x,
                originalY: book.y
            };
            
            console.log(`Adjusting book "${book.title}" from section ${sectionIndex} (${row},${col}):`);
            console.log(`  Original: (${book.x}%, ${book.y}%) -> Adjusted: (${adjustedBook.x.toFixed(1)}%, ${adjustedBook.y.toFixed(1)}%)`);
            
            return adjustedBook;
        });
    }

    createBookOverlays(books) {
        // Clear existing overlays
        this.imageOverlay.innerHTML = '';
        
        console.log(`Creating overlays for ${books.length} books`);
        
        const image = this.uploadedImage;
        const overlay = this.imageOverlay;
        
        if (!image || !overlay) {
            console.error('Image or overlay not found');
            return;
        }
        
        // Calculate the actual displayed image dimensions within the container
        const containerRect = overlay.getBoundingClientRect();
        const imageNaturalRatio = image.naturalWidth / image.naturalHeight;
        const containerRatio = containerRect.width / containerRect.height;
        
        let imageDisplayWidth, imageDisplayHeight, imageOffsetX, imageOffsetY;
        
        if (imageNaturalRatio > containerRatio) {
            // Image is wider - will be constrained by width
            imageDisplayWidth = containerRect.width;
            imageDisplayHeight = containerRect.width / imageNaturalRatio;
            imageOffsetX = 0;
            imageOffsetY = (containerRect.height - imageDisplayHeight) / 2;
        } else {
            // Image is taller - will be constrained by height
            imageDisplayWidth = containerRect.height * imageNaturalRatio;
            imageDisplayHeight = containerRect.height;
            imageOffsetX = (containerRect.width - imageDisplayWidth) / 2;
            imageOffsetY = 0;
        }
        
        console.log('Container size:', containerRect.width, 'x', containerRect.height);
        console.log('Image natural size:', image.naturalWidth, 'x', image.naturalHeight);
        console.log('Image display size:', imageDisplayWidth, 'x', imageDisplayHeight);
        console.log('Image offset:', imageOffsetX, 'x', imageOffsetY);
        
        let overlayCount = 0;
        books.forEach((book, index) => {
            const title = typeof book === 'string' ? book : book.title;
            const hasPosition = book.x !== undefined && book.y !== undefined;
            
            console.log(`Book ${index + 1}: "${title}", has position: ${hasPosition}`, book);
            
            if (!hasPosition) {
                console.log(`Skipping "${title}" - no position data`);
                return;
            }
            
            // Convert percentage positions to actual pixel positions within the displayed image area
            const bookLeft = imageOffsetX + (book.x / 100) * imageDisplayWidth;
            const bookTop = imageOffsetY + (book.y / 100) * imageDisplayHeight;
            const bookWidth = (book.width || 10) / 100 * imageDisplayWidth;
            const bookHeight = (book.height || 15) / 100 * imageDisplayHeight;
            
            console.log(`Book "${title}" positioning:`, {
                section: book.sectionIndex !== undefined ? `Section ${book.sectionIndex}` : 'No section',
                originalCoords: book.originalX !== undefined ? `(${book.originalX}%, ${book.originalY}%)` : 'N/A',
                adjustedPercentages: `${book.x}%, ${book.y}%, ${book.width}%, ${book.height}%`,
                finalPixels: `${bookLeft.toFixed(1)}px, ${bookTop.toFixed(1)}px, ${bookWidth.toFixed(1)}px, ${bookHeight.toFixed(1)}px`,
                imageDisplay: `${imageDisplayWidth.toFixed(1)}x${imageDisplayHeight.toFixed(1)}`,
                imageOffset: `${imageOffsetX.toFixed(1)}, ${imageOffsetY.toFixed(1)}`
            });
            
            const bookOverlay = document.createElement('div');
            bookOverlay.className = 'book-overlay';
            bookOverlay.style.cssText = `
                position: absolute;
                left: ${bookLeft}px;
                top: ${bookTop}px;
                width: ${bookWidth}px;
                height: ${bookHeight}px;
                border: 3px solid #00ff00;
                background: rgba(0, 255, 0, 0.2);
                box-shadow: 0 0 5px rgba(0, 255, 0, 0.5);
                cursor: pointer;
                z-index: 10;
                transition: all 0.2s ease;
                pointer-events: auto;
                box-sizing: border-box;
            `;
            
            // Add hover effects
            bookOverlay.addEventListener('mouseenter', () => {
                bookOverlay.style.background = 'rgba(0, 255, 0, 0.3)';
                bookOverlay.style.borderColor = '#00aa00';
            });
            
            bookOverlay.addEventListener('mouseleave', () => {
                bookOverlay.style.background = 'rgba(0, 255, 0, 0.1)';
                bookOverlay.style.borderColor = '#00ff00';
            });
            
            // Add click handler for individual book identification
            bookOverlay.addEventListener('click', (e) => {
                e.preventDefault();
                this.identifyIndividualBook(book, bookOverlay);
            });
            
            // Add tooltip
            const tooltip = document.createElement('div');
            tooltip.className = 'book-tooltip';
            tooltip.textContent = book.title || 'Unknown Book';
            tooltip.style.cssText = `
                position: absolute;
                bottom: 100%;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                white-space: nowrap;
                opacity: 0;
                transition: opacity 0.2s ease;
                pointer-events: none;
                z-index: 11;
            `;
            
            bookOverlay.addEventListener('mouseenter', () => {
                tooltip.style.opacity = '1';
            });
            
            bookOverlay.addEventListener('mouseleave', () => {
                tooltip.style.opacity = '0';
            });
            
            bookOverlay.appendChild(tooltip);
            this.imageOverlay.appendChild(bookOverlay);
            overlayCount++;
        });
        
        console.log(`Created ${overlayCount} book overlays out of ${books.length} books`);
        
        // Add temporary section grid overlay for debugging
        this.addSectionGridOverlay(imageDisplayWidth, imageDisplayHeight, imageOffsetX, imageOffsetY);
    }

    addSectionGridOverlay(imageDisplayWidth, imageDisplayHeight, imageOffsetX, imageOffsetY) {
        // Add section grid lines to help debug positioning
        const sectionsX = 8, sectionsY = 5; // Match our scanning grid
        const sectionWidth = imageDisplayWidth / sectionsX;
        const sectionHeight = imageDisplayHeight / sectionsY;
        
        // Draw vertical lines
        for (let i = 1; i < sectionsX; i++) {
            const line = document.createElement('div');
            line.style.cssText = `
                position: absolute;
                left: ${imageOffsetX + i * sectionWidth}px;
                top: ${imageOffsetY}px;
                width: 1px;
                height: ${imageDisplayHeight}px;
                background: rgba(255, 0, 0, 0.3);
                z-index: 5;
                pointer-events: none;
            `;
            this.imageOverlay.appendChild(line);
        }
        
        // Draw horizontal lines
        for (let i = 1; i < sectionsY; i++) {
            const line = document.createElement('div');
            line.style.cssText = `
                position: absolute;
                left: ${imageOffsetX}px;
                top: ${imageOffsetY + i * sectionHeight}px;
                width: ${imageDisplayWidth}px;
                height: 1px;
                background: rgba(255, 0, 0, 0.3);
                z-index: 5;
                pointer-events: none;
            `;
            this.imageOverlay.appendChild(line);
        }
        
        // Add section numbers
        for (let row = 0; row < sectionsY; row++) {
            for (let col = 0; col < sectionsX; col++) {
                const sectionIndex = row * sectionsX + col;
                const label = document.createElement('div');
                label.style.cssText = `
                    position: absolute;
                    left: ${imageOffsetX + col * sectionWidth + 5}px;
                    top: ${imageOffsetY + row * sectionHeight + 5}px;
                    background: rgba(255, 0, 0, 0.7);
                    color: white;
                    padding: 2px 4px;
                    font-size: 10px;
                    font-weight: bold;
                    border-radius: 2px;
                    z-index: 6;
                    pointer-events: none;
                `;
                label.textContent = sectionIndex;
                this.imageOverlay.appendChild(label);
            }
        }
    }

    async identifyIndividualBook(book, overlay) {
        try {
            overlay.style.borderColor = '#ff6600';
            overlay.style.background = 'rgba(255, 102, 0, 0.2)';
            
            console.log(`Identifying individual book: ${book.title}`);
            
            // Search for the book in Google Books
            const bookData = await this.searchForBookQuick(book.title);
            
            if (bookData) {
                // Show book details in a popup
                const popup = this.createBookDetailsPopup(bookData);
                document.body.appendChild(popup);
                
                // Add to library option
                const addButton = popup.querySelector('.add-to-library-btn');
                if (addButton) {
                    addButton.addEventListener('click', () => {
                        this.addBookToLibrary(bookData, book); // Pass the book position data
                        document.body.removeChild(popup);
                        overlay.style.borderColor = '#00aa00';
                        overlay.style.background = 'rgba(0, 170, 0, 0.2)';
                    });
                }
            } else {
                alert(`Could not find detailed information for "${book.title}" in the book database.`);
                overlay.style.borderColor = '#ff0000';
                overlay.style.background = 'rgba(255, 0, 0, 0.1)';
            }
            
        } catch (error) {
            console.error('Error identifying book:', error);
            alert('Error identifying book. Please try again.');
        }
    }

    createBookDetailsPopup(bookData) {
        const popup = document.createElement('div');
        popup.className = 'book-details-popup';
        popup.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border: 2px solid #333;
            border-radius: 8px;
            padding: 20px;
            max-width: 400px;
            max-height: 80vh;
            overflow-y: auto;
            z-index: 1000;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        `;
        
        popup.innerHTML = `
            <div style="display: flex; gap: 15px; margin-bottom: 15px;">
                ${bookData.thumbnail ? `<img src="${bookData.thumbnail}" alt="Book cover" style="width: 80px; height: auto; border-radius: 4px;">` : ''}
                <div style="flex: 1;">
                    <h3 style="margin: 0 0 10px 0; color: #333;">${bookData.title}</h3>
                    <p style="margin: 5px 0; color: #666;"><strong>Author:</strong> ${bookData.authors.join(', ')}</p>
                    <p style="margin: 5px 0; color: #666;"><strong>Published:</strong> ${bookData.publishedDate}</p>
                    ${bookData.isbn !== 'N/A' ? `<p style="margin: 5px 0; color: #666;"><strong>ISBN:</strong> ${bookData.isbn}</p>` : ''}
                </div>
            </div>
            ${bookData.description ? `<p style="margin: 10px 0; color: #333; font-size: 14px;">${bookData.description.substring(0, 200)}${bookData.description.length > 200 ? '...' : ''}</p>` : ''}
            <div style="display: flex; gap: 10px; margin-top: 15px;">
                <button class="add-to-library-btn" style="flex: 1; padding: 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Add to Library</button>
                <button class="close-popup-btn" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">Close</button>
            </div>
        `;
        
        // Add close functionality
        const closeBtn = popup.querySelector('.close-popup-btn');
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(popup);
        });
        
        // Close on background click
        popup.addEventListener('click', (e) => {
            if (e.target === popup) {
                document.body.removeChild(popup);
            }
        });
        
        return popup;
    }

    async analyzeWithOpenAIWithRetry(imageDataURL, sectionInfo = '', maxRetries = 3) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await this.analyzeWithOpenAI(imageDataURL, sectionInfo);
            } catch (error) {
                const isRateLimit = error.message.includes('429') || error.message.includes('rate limit') || error.message.includes('Too Many Requests');
                
                if (isRateLimit && attempt < maxRetries) {
                    // Exponential backoff: 2s, 5s, 12s
                    const delay = Math.min(2000 * Math.pow(2.5, attempt - 1), 15000);
                    console.log(`Rate limit hit for ${sectionInfo}, retrying in ${delay/1000}s (attempt ${attempt}/${maxRetries})`);
                    this.processingText.textContent = `Scanning Books - ${sectionInfo} (retrying...)`;
                    
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                
                // If not a rate limit error, or we've exhausted retries, throw the error
                throw error;
            }
        }
    }

    async analyzeWithOpenAI(imageDataURL, sectionInfo = '') {
        // Use our proxy server instead of direct API call
        const response = await fetch('/api/openai', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                                                text: `You are a professional librarian cataloging books. Analyze this bookshelf section with extreme precision.

ACCURACY PROTOCOL:
1. SCAN SYSTEMATICALLY: Examine every book spine from left to right, top to bottom
2. READ CAREFULLY: Only include titles where you can clearly read the text
3. BE THOROUGH: Don't miss books due to small text or unusual fonts
4. VERIFY VISIBILITY: Only include books that are actually visible in this image section

WHAT TO DETECT:
- Book titles on spines (main title text)
- Author names if clearly visible
- Series names if part of the main title
- Partial titles if the visible portion is clearly readable

WHAT TO EXCLUDE:
- Magazines, DVDs, decorative objects
- Text that's too blurry to read
- Titles you're not certain about
- Non-book items

CONFIDENCE LEVELS:
- HIGH: Text is clearly readable and obviously a book title
- MEDIUM: Text is readable but might be partial or unclear
- LOW: Text is barely visible or questionable

Return a JSON array with confidence levels:
[
  {"title": "Clear Book Title", "confidence": "high"},
  {"title": "Partial Title", "confidence": "medium"},
  {"title": "Questionable Text", "confidence": "low"}
]

If no books detected, return: []

Be thorough but accurate. Better to include questionable titles with low confidence than miss real books.`
                            },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: imageDataURL
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 500
            })
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices[0].message.content.trim();
        
        console.log('AI Response:', content);
        
        try {
            // Clean up markdown code blocks if present
            let cleanContent = content;
            if (cleanContent.includes('```json') || cleanContent.includes('```')) {
                cleanContent = cleanContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                console.log('Cleaned markdown from response:', cleanContent);
            }
            
            // Check if response is a text message instead of JSON
            if (!cleanContent.startsWith('[') && !cleanContent.startsWith('{')) {
                console.log('AI returned text response (likely no books found):', cleanContent);
                return [];
            }
            
            // Parse the JSON response
            const bookData = JSON.parse(cleanContent);
            if (Array.isArray(bookData)) {
                // Handle both old format (strings) and new format (objects with position)
                return bookData.map(item => {
                    if (typeof item === 'string') {
                        return { title: item }; // No position data for strings
                    }
                    
                    // Validate coordinates for positioned items
                    if (item.x !== undefined && item.y !== undefined) {
                        // Check if coordinates are reasonable (0-100%)
                        if (item.x < 0 || item.x > 100 || item.y < 0 || item.y > 100) {
                            console.warn(`Invalid coordinates for "${item.title}": (${item.x}, ${item.y})`);
                            return { title: item.title }; // Return without position
                        }
                        
                        // Ensure width and height are reasonable
                        item.width = Math.min(Math.max(item.width || 12, 5), 30); // 5-30%
                        item.height = Math.min(Math.max(item.height || 25, 10), 50); // 10-50%
                    }
                    
                    return item;
                });
            }
            return [];
        } catch (parseError) {
            console.error('Error parsing AI response:', parseError);
            console.log('Failed content:', content);
            
            // Try to extract JSON from mixed response
            const jsonMatch = content.match(/\[[\s\S]*?\]/);
            if (jsonMatch) {
                try {
                    const extractedData = JSON.parse(jsonMatch[0]);
                    console.log('Successfully extracted JSON from mixed response');
                    return extractedData.map(item => typeof item === 'string' ? { title: item } : item);
                } catch (e) {
                    console.error('Could not parse extracted JSON either');
                }
            }
            
            // If no JSON found, check if it's a clear "no books" message
            if (content.toLowerCase().includes("can't detect") || 
                content.toLowerCase().includes("no readable") ||
                content.toLowerCase().includes("unclear") ||
                content.toLowerCase().includes("difficult to analyze")) {
                console.log('AI indicated no readable books in this section');
                return [];
            }
            
            // Last resort: try to extract titles from text response
            const lines = content.split('\n').filter(line => line.trim().length > 2);
            const extractedTitles = lines.map(line => line.replace(/^[\d\.\-\*\s]+/, '').trim()).filter(title => title.length > 2);
            if (extractedTitles.length > 0) {
                console.log('Extracted titles from text response:', extractedTitles);
                return extractedTitles.map(title => ({ title }));
            }
            
            return [];
        }
    }

    async processAIDetectedBooks(bookTitles) {
        console.log('AI detected books:', bookTitles);
        
        this.processingText.textContent = `Looking up ${bookTitles.length} detected books...`;
        
        const foundBooks = [];
        
        for (let i = 0; i < Math.min(bookTitles.length, 150); i++) { // Increased to handle more books
            const bookItem = bookTitles[i];
            const title = typeof bookItem === 'string' ? bookItem : bookItem.title;
            this.processingText.textContent = `Looking up book ${i + 1}/${Math.min(bookTitles.length, 150)}: "${title.substring(0, 30)}${title.length > 30 ? '...' : ''}"`;
            
            try {
                const bookData = await this.searchForBookQuick(title);
                if (bookData) {
                    foundBooks.push(bookData);
                    console.log(`✅ Found: ${bookData.title}`);
                } else {
                    console.log(`❌ Not found in database: ${title}`);
                }
            } catch (error) {
                console.error(`🔥 Error searching for "${title}":`, error);
            }
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        this.hideProcessing();
        
        if (foundBooks.length > 0) {
            // Filter out books already in library
            const newBooks = foundBooks.filter(book => {
                const existingBook = this.library.find(libBook => 
                    libBook.isbn === book.isbn && book.isbn !== 'N/A'
                );
                if (existingBook) {
                    console.log(`📚 Book "${book.title}" already in library - skipping`);
                    return false;
                }
                return true;
            });
            
            if (newBooks.length > 0) {
            const addAll = confirm(
                    `AI found ${newBooks.length} new book${newBooks.length > 1 ? 's' : ''} from your bookshelf:\n\n` +
                    newBooks.map(book => `• ${book.title} by ${book.authors.join(', ')}`).join('\n') +
                    `\n\n${foundBooks.length - newBooks.length > 0 ? `(${foundBooks.length - newBooks.length} book${foundBooks.length - newBooks.length > 1 ? 's' : ''} already in library - skipped)\n\n` : ''}` +
                    'Add these new books to your library?'
            );
            
            if (addAll) {
                    // Generate a unique filename for this scan
                    const scanId = Date.now().toString();
                    const photoFileName = `scan_${scanId}.jpg`;
                    
                    // Add each book with the photo
                    for (const book of newBooks) {
                        await this.addBookWithPhoto(book, this.currentPhotoData, photoFileName);
                    }
                }
            } else {
                alert(`All ${foundBooks.length} detected book${foundBooks.length > 1 ? 's' : ''} are already in your library!`);
            }
        } else {
            alert(`AI detected ${bookTitles.length} potential titles but couldn't find them in the book database:\n\n${bookTitles.join(', ')}`);
        }
    }

    showManualEntryDialog() {
        const titles = prompt(
            'Enter book titles separated by commas or new lines:\n\n' +
            'Example:\n' +
            'The Great Gatsby\n' +
            'To Kill a Mockingbird\n' +
            'Pride and Prejudice'
        );
        
        if (titles && titles.trim()) {
            const bookTitles = titles.split(/[,\n]/)
                .map(title => title.trim())
                .filter(title => title.length > 2);
            
            if (bookTitles.length > 0) {
                this.processManualTitles(bookTitles);
            }
        }
    }

    async processManualTitles(titles) {
        this.showProcessing(`Searching for ${titles.length} books...`);
        
        const foundBooks = [];
        
        for (let i = 0; i < titles.length; i++) {
            const title = titles[i];
            this.processingText.textContent = `Scanning Books...`;
            
            try {
                const bookData = await this.searchForBookQuick(title);
                if (bookData) {
                    foundBooks.push(bookData);
                    console.log(`Found: ${bookData.title}`);
                }
            } catch (error) {
                console.error(`Error searching for "${title}":`, error);
            }
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        this.hideProcessing();
        
        if (foundBooks.length > 0) {
            const addAll = confirm(
                `Found ${foundBooks.length} book${foundBooks.length > 1 ? 's' : ''}:\n\n` +
                foundBooks.map(book => `• ${book.title} by ${book.authors.join(', ')}`).join('\n') +
                '\n\nAdd all these books to your library?'
            );
            
            if (addAll) {
                foundBooks.forEach(book => this.addBookToLibrary(book));
            }
        } else {
            alert('No books could be found. Please check the titles and try again.');
        }
    }

    async processPhotoDetectedText(text, ocrData) {
        console.log('Processing detected text:', text);
        
        const potentialTitles = this.extractBookTitles(text, ocrData);
        console.log('Potential titles found:', potentialTitles);
        
        if (potentialTitles.length === 0) {
            this.hideProcessing();
            alert(`Found text but no recognizable book titles. Extracted text: "${text.substring(0, 200)}...". Try a photo with clearer book spine text.`);
            return;
        }
        
        const detectedBooks = [];
        this.processingText.textContent = `Scanning Books...`;
        
        for (let i = 0; i < Math.min(potentialTitles.length, 10); i++) { // Limit to 10 to avoid rate limits
            const titleInfo = potentialTitles[i];
            try {
                console.log(`Searching for: "${titleInfo.text}"`);
                this.processingText.textContent = `Scanning Books...`;
                
                const bookData = await this.searchForBookQuick(titleInfo.text);
                if (bookData) {
                    detectedBooks.push({
                        book: bookData,
                        position: titleInfo.bbox
                    });
                    
                    console.log(`Found book: ${bookData.title}`);
                    // Show progress
                    this.processingText.textContent = `Scanning Books...`;
                }
                
                // Add small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (error) {
                console.error('Error searching for book:', titleInfo.text, error);
            }
        }
        
        this.hideProcessing();
        
        if (detectedBooks.length > 0) {
            this.displayPhotoResults(detectedBooks);
        } else {
            // Show what text was found for debugging
            const textSample = potentialTitles.map(t => `"${t.text}"`).join(', ');
            alert(`Found potential titles but couldn't identify books: ${textSample}. This might be due to unclear text or books not in the database. Try a clearer photo or check if the books are visible.`);
        }
    }

    displayPhotoResults(detectedBooks) {
        // Clear previous overlays
        this.imageOverlay.innerHTML = '';
        
        // Create overlay for each detected book
        detectedBooks.forEach((detection, index) => {
            const overlay = document.createElement('div');
            overlay.className = 'book-detection';
            overlay.style.left = detection.position.left + 'px';
            overlay.style.top = detection.position.top + 'px';
            overlay.style.width = detection.position.width + 'px';
            overlay.style.height = detection.position.height + 'px';
            
            const label = document.createElement('div');
            label.className = 'book-label';
            label.textContent = detection.book.title;
            overlay.appendChild(label);
            
            // Add click handler
            overlay.addEventListener('click', () => {
                this.addBookToLibrary(detection.book);
            });
            
            this.imageOverlay.appendChild(overlay);
        });
        
        // Show summary
        const summary = `Found ${detectedBooks.length} book${detectedBooks.length > 1 ? 's' : ''} in your photo! Click on any highlighted book to add it to your library.`;
        alert(summary);
    }

    async searchForBookQuick(query) {
        // Simplified search for real-time detection (faster, less detailed)
        try {
            const cleanQuery = this.cleanOCRText(query);
            const response = await fetch(
                `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(cleanQuery)}&maxResults=3`
            );
            
            if (!response.ok) return null;
            
            const data = await response.json();
            
            if (data.items && data.items.length > 0) {
                const book = data.items[0].volumeInfo;
                return {
                    title: book.title || 'Unknown Title',
                    authors: book.authors || ['Unknown Author'],
                    isbn: this.extractISBN(book.industryIdentifiers) || 'N/A',
                    publishedDate: book.publishedDate || 'Unknown',
                    description: book.description || 'No description available',
                    thumbnail: book.imageLinks?.thumbnail || book.imageLinks?.smallThumbnail || '',
                    source: 'Google Books'
                };
            }
            
            return null;
        } catch (error) {
            return null;
        }
    }

    cleanOCRText(text) {
        let cleaned = text
            .replace(/[^\w\s\-']/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        
        const lines = cleaned.split('\n').filter(line => line.trim().length > 3);
        if (lines.length > 0) {
            return lines[0].substring(0, 100);
        }
        
        return cleaned.substring(0, 50);
    }

    extractISBN(identifiers) {
        if (!identifiers) return null;
        
        for (const id of identifiers) {
            if (id.type === 'ISBN_13') return id.identifier;
            if (id.type === 'ISBN_10') return id.identifier;
        }
        
        return identifiers[0]?.identifier || null;
    }

    addBookToLibrary(bookData, photoPosition = null) {
        // Check if book already exists
        const existingBook = this.library.find(book => 
            book.isbn === bookData.isbn && book.isbn !== 'N/A'
        );
        
        if (existingBook) {
            console.log(`📚 Book "${bookData.title}" already in library - skipping silently`);
            return;
        }
        
        // Add timestamp, unique ID, and photo position (but not full photo data to save storage)
        const bookToAdd = {
            ...bookData,
            id: Date.now(),
            addedDate: new Date().toISOString(),
            photoPosition: photoPosition, // Store where this book was found in the photo
            photoFileName: this.currentPhotoData?.fileName, // Just store filename, not full photo
            photoDate: this.currentPhotoData?.uploadDate // Store when photo was taken
        };
        
        this.library.push(bookToAdd);
        this.saveLibrary();
        this.updateLibraryDisplay();
        
        // Show success message
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 15px;
            border-radius: 8px;
            z-index: 1000;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        `;
        notification.textContent = `"${bookData.title}" added to library!`;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 3000);
    }

    showProcessing(message) {
        this.processingText.textContent = message;
        this.processingSection.style.display = 'block';
    }

    hideProcessing() {
        this.processingSection.style.display = 'none';
    }

    hideResults() {
        this.processingSection.style.display = 'none';
        this.bookDetails.style.display = 'none';
        this.extractedText.style.display = 'none';
    }

    getAuthorLastName(authorName) {
        if (!authorName || authorName === 'Unknown Author') {
            return 'ZZZ'; // Sort unknown authors to the end
        }
        
        // Handle different author name formats
        const parts = authorName.trim().split(/\s+/);
        
        if (parts.length === 1) {
            return parts[0]; // Single name
        } else if (parts.length === 2) {
            return parts[1]; // "First Last"
        } else {
            // Handle "First Middle Last" or "First Last Jr." etc.
            // Return the second-to-last part as last name (handles Jr., Sr., etc.)
            return parts[parts.length - 2] || parts[parts.length - 1];
        }
    }

    updateLibraryDisplay() {
        this.bookCount.textContent = this.library.length;
        
        if (this.library.length === 0) {
            this.libraryGrid.innerHTML = `
                <div class="empty-library">
                    <p>No books scanned yet. Start by scanning your first book!</p>
                </div>
            `;
        } else {
            // Sort books alphabetically by author's last name
            const sortedLibrary = [...this.library].sort((a, b) => {
                const authorA = this.getAuthorLastName(a.authors?.[0] || 'Unknown Author');
                const authorB = this.getAuthorLastName(b.authors?.[0] || 'Unknown Author');
                return authorA.localeCompare(authorB);
            });

            this.libraryGrid.innerHTML = sortedLibrary.map((book, sortedIndex) => {
                // Find the original index for the actions
                const originalIndex = this.library.findIndex(originalBook => 
                    originalBook.id === book.id || 
                    (originalBook.title === book.title && originalBook.authors?.[0] === book.authors?.[0])
                );
                return `
                <div class="book-card" data-book-index="${originalIndex}">
                    <div class="book-card-content" onclick="bookshelfScanner.showBookDetails(${originalIndex})">
                        ${book.photoURL ? `<img src="${book.photoURL}" alt="${book.title}" class="user-photo">` : 
                          book.thumbnail ? `<img src="${book.thumbnail}" alt="${book.title}">` : 
                          '<div class="no-image">📚</div>'}
                        <h5>${book.title}</h5>
                        <p class="author">${book.authors.join(', ')}</p>
                        <p class="isbn">${book.isbn}</p>
                        <p class="date">Added: ${new Date(book.addedDate).toLocaleDateString()}</p>
                    </div>
                    <div class="book-card-actions">
                        ${book.photoURL ? `
                            <button class="btn-find-photo" onclick="bookshelfScanner.findBookPhoto(${originalIndex})" title="Find photo this book came from">
                                <span class="icon">📸</span>
                            </button>
                        ` : ''}
                        ${book.photoPosition ? `
                            <button class="btn-locate" onclick="bookshelfScanner.showBookInPhoto(${originalIndex})" title="Show in current photo">
                                <span class="icon">📍</span>
                            </button>
                        ` : ''}
                        <button class="btn-replace" onclick="bookshelfScanner.showReplaceOptions(${originalIndex})" title="Find other versions of this book">
                            <span class="icon">🔄</span>
                        </button>
                        <button class="btn-remove" onclick="bookshelfScanner.removeBookFromLibrary(${originalIndex})" title="Remove from library">
                            <span class="icon">🗑️</span>
                        </button>
                    </div>
                </div>
            `;
            }).join('');
        }
    }

    filterLibrary(searchTerm) {
        const searchLower = searchTerm.toLowerCase().trim();
        
        if (!searchLower) {
            // If search is empty, show all books
            this.updateLibraryDisplay();
            return;
        }

        // Filter books based on title or author
        const filteredBooks = this.library.filter(book => {
            const titleMatch = book.title.toLowerCase().includes(searchLower);
            const authorMatch = book.authors.some(author => 
                author.toLowerCase().includes(searchLower)
            );
            return titleMatch || authorMatch;
        });

        // Update display with filtered books
        this.renderFilteredLibrary(filteredBooks, searchTerm);
    }

    renderFilteredLibrary(filteredBooks, searchTerm) {
        this.bookCount.textContent = `${filteredBooks.length} of ${this.library.length}`;
        
        if (filteredBooks.length === 0) {
            this.libraryGrid.innerHTML = `
                <div class="empty-library">
                    <p>No books found matching "${searchTerm}"</p>
                    <p style="color: #666; font-size: 14px;">Try searching by title or author name</p>
                </div>
            `;
            return;
        }

        // Sort filtered books alphabetically by author's last name
        const sortedBooks = [...filteredBooks].sort((a, b) => {
            const authorA = this.getAuthorLastName(a.authors?.[0] || 'Unknown Author');
            const authorB = this.getAuthorLastName(b.authors?.[0] || 'Unknown Author');
            return authorA.localeCompare(authorB);
        });

        this.libraryGrid.innerHTML = sortedBooks.map((book) => {
            // Find the original index for the actions
            const originalIndex = this.library.findIndex(originalBook => 
                originalBook.id === book.id || 
                (originalBook.title === book.title && originalBook.authors?.[0] === book.authors?.[0])
            );
            
            // Highlight search terms in the display
            const highlightedTitle = this.highlightSearchTerm(book.title, searchTerm);
            const highlightedAuthor = book.authors.map(author => 
                this.highlightSearchTerm(author, searchTerm)
            ).join(', ');
            
            return `
                <div class="book-card" data-book-index="${originalIndex}">
                    <div class="book-card-content" onclick="bookshelfScanner.showBookDetails(${originalIndex})">
                        ${book.thumbnail ? `<img src="${book.thumbnail}" alt="${book.title}">` : '<div class="no-image">📚</div>'}
                        <h5>${highlightedTitle}</h5>
                        <p class="author">${highlightedAuthor}</p>
                        <p class="isbn">${book.isbn}</p>
                        <p class="date">Added: ${new Date(book.addedDate).toLocaleDateString()}</p>
                    </div>
                    <div class="book-card-actions">
                        ${book.photoURL ? `
                            <button class="btn-find-photo" onclick="bookshelfScanner.findBookPhoto(${originalIndex})" title="Find photo this book came from">
                                <span class="icon">📸</span>
                            </button>
                        ` : ''}
                        ${book.photoPosition ? `
                            <button class="btn-locate" onclick="bookshelfScanner.showBookInPhoto(${originalIndex})" title="Show in current photo">
                                <span class="icon">📍</span>
                            </button>
                        ` : ''}
                        <button class="btn-replace" onclick="bookshelfScanner.showReplaceOptions(${originalIndex})" title="Find other versions of this book">
                            <span class="icon">🔄</span>
                        </button>
                        <button class="btn-remove" onclick="bookshelfScanner.removeBookFromLibrary(${originalIndex})" title="Remove from library">
                            <span class="icon">🗑️</span>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    highlightSearchTerm(text, searchTerm) {
        if (!searchTerm) return text;
        
        const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    showBookDetails(bookIndex) {
        const book = this.library[bookIndex];
        if (!book) return;
        
        const modal = this.createBookDetailsModal(book, bookIndex);
        document.body.appendChild(modal);
    }
    
    createBookDetailsModal(book, bookIndex) {
        const modal = document.createElement('div');
        modal.className = 'book-details-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        `;
        
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        modalContent.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 30px;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
            position: relative;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        `;
        
        modalContent.innerHTML = `
            <button class="modal-close" style="
                position: absolute;
                top: 15px;
                right: 20px;
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #666;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: background 0.2s ease;
            " onmouseover="this.style.background='#f0f0f0'" onmouseout="this.style.background='none'">×</button>
            
            <div style="display: flex; gap: 20px; margin-bottom: 20px;">
                <div style="flex-shrink: 0;">
                    ${book.photoURL ? 
                        `<img src="${book.photoURL}" alt="${book.title}" style="width: 120px; height: auto; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);" title="Your photo of this book">` : 
                        book.thumbnail ? 
                        `<img src="${book.thumbnail}" alt="${book.title}" style="width: 120px; height: auto; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">` : 
                        '<div style="width: 120px; height: 160px; background: #f0f0f0; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 48px;">📚</div>'
                    }
                </div>
                <div style="flex: 1;">
                    <h2 style="margin: 0 0 10px 0; color: #333; font-size: 24px;">${book.title}</h2>
                    <p style="margin: 5px 0; color: #666; font-size: 16px;"><strong>Author(s):</strong> ${book.authors.join(', ')}</p>
                    <p style="margin: 5px 0; color: #666; font-size: 14px;"><strong>Published:</strong> ${book.publishedDate}</p>
                    ${book.isbn !== 'N/A' ? `<p style="margin: 5px 0; color: #666; font-size: 14px;"><strong>ISBN:</strong> ${book.isbn}</p>` : ''}
                    <p style="margin: 5px 0; color: #666; font-size: 14px;"><strong>Added to Library:</strong> ${new Date(book.addedDate).toLocaleDateString()}</p>
                </div>
            </div>
            
            ${book.description ? `
                <div style="margin: 20px 0;">
                    <h3 style="color: #333; margin-bottom: 10px;">Description</h3>
                    <p style="line-height: 1.6; color: #555; font-size: 15px;">${book.description}</p>
                </div>
            ` : ''}
            
            <div style="display: flex; gap: 10px; margin-top: 25px; justify-content: space-between;">
                <button class="remove-book-btn" style="
                    padding: 12px 20px;
                    background: #dc3545;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    transition: background 0.2s ease;
                " onmouseover="this.style.background='#c82333'" onmouseout="this.style.background='#dc3545'">
                    🗑️ Remove from Library
                </button>
                <button class="close-modal-btn" style="
                    padding: 12px 20px;
                    background: #6c757d;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    transition: background 0.2s ease;
                " onmouseover="this.style.background='#5a6268'" onmouseout="this.style.background='#6c757d'">
                    Close
                </button>
            </div>
        `;
        
        modal.appendChild(modalContent);
        
        // Add event listeners
        const closeBtn = modalContent.querySelector('.modal-close');
        const closeModalBtn = modalContent.querySelector('.close-modal-btn');
        const removeBtn = modalContent.querySelector('.remove-book-btn');
        
        const closeModal = () => {
            document.body.removeChild(modal);
        };
        
        closeBtn.addEventListener('click', closeModal);
        closeModalBtn.addEventListener('click', closeModal);
        
        removeBtn.addEventListener('click', () => {
            if (confirm(`Are you sure you want to remove "${book.title}" from your library?`)) {
                this.removeBookFromLibrary(bookIndex);
                closeModal();
            }
        });
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
        
        // Close on Escape key
        const handleKeyPress = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleKeyPress);
            }
        };
        document.addEventListener('keydown', handleKeyPress);
        
        return modal;
    }
    
    showBookInPhoto(bookIndex) {
        const book = this.library[bookIndex];
        if (!book || !book.photoPosition) {
            alert('No photo location data available for this book.');
            return;
        }
        
        if (!this.currentPhotoData || !this.uploadedImage.src) {
            alert('Please upload a bookshelf photo first to see book locations.');
            return;
        }
        
        // Create a modal showing the current photo with the book highlighted
        const modal = this.createPhotoLocationModal(book);
        document.body.appendChild(modal);
    }
    
    createPhotoLocationModal(book) {
        const modal = document.createElement('div');
        modal.className = 'photo-location-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        `;
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 20px;
            max-width: 90vw;
            max-height: 90vh;
            position: relative;
            overflow: hidden;
        `;
        
        modalContent.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px;">
                <h3 style="margin: 0; color: #333;">📍 "${book.title}" Location in Photo</h3>
                <button class="modal-close" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">×</button>
            </div>
            <div class="photo-container" style="position: relative; display: inline-block;">
                <img src="${this.currentPhotoData.dataURL}" alt="Bookshelf photo" style="max-width: 70vw; max-height: 70vh; border-radius: 8px;">
                <div class="book-highlight" style="
                    position: absolute;
                    left: ${book.photoPosition.x}%;
                    top: ${book.photoPosition.y}%;
                    width: ${book.photoPosition.width || 12}%;
                    height: ${book.photoPosition.height || 25}%;
                    border: 3px solid #ff6600;
                    background: rgba(255, 102, 0, 0.2);
                    box-shadow: 0 0 10px rgba(255, 102, 0, 0.5);
                    animation: pulse 2s infinite;
                "></div>
            </div>
            <p style="text-align: center; margin: 15px 0 0 0; color: #666;">
                Orange highlight shows where "${book.title}" was detected in your bookshelf photo
            </p>
        `;
        
        modal.appendChild(modalContent);
        
        // Add pulse animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes pulse {
                0% { opacity: 0.6; transform: scale(1); }
                50% { opacity: 1; transform: scale(1.05); }
                100% { opacity: 0.6; transform: scale(1); }
            }
        `;
        document.head.appendChild(style);
        
        // Add close functionality
        const closeBtn = modalContent.querySelector('.modal-close');
        const closeModal = () => {
            document.body.removeChild(modal);
            document.head.removeChild(style);
        };
        
        closeBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        
        // Close on Escape key
        const handleKeyPress = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleKeyPress);
            }
        };
        document.addEventListener('keydown', handleKeyPress);
        
        return modal;
    }

    removeBookFromLibrary(bookIndex) {
        if (bookIndex < 0 || bookIndex >= this.library.length) return;
        
        const book = this.library[bookIndex];
        console.log(`Removing book from library: ${book.title}`);
        
        // Remove the book from the library array
        this.library.splice(bookIndex, 1);
        
        // Save the updated library
        this.saveLibrary();
        
        // Update the display
        this.updateLibraryDisplay();
    }

    async showReplaceOptions(bookIndex) {
        const book = this.library[bookIndex];
        if (!book) return;

        try {
            // Show loading state
            const loadingModal = this.createLoadingModal(`Searching for other versions of "${book.title}"...`);
            document.body.appendChild(loadingModal);

            // Search for books with the same title
            const alternateBooks = await this.searchForAlternateVersions(book.title);
            
            // Remove loading modal
            document.body.removeChild(loadingModal);

            if (alternateBooks.length === 0) {
                alert(`No alternate versions found for "${book.title}"`);
                return;
            }

            // Show replacement modal
            this.showReplacementModal(book, alternateBooks, bookIndex);

        } catch (error) {
            console.error('Error searching for alternate versions:', error);
            alert('Error searching for alternate versions. Please try again.');
        }
    }

    async searchForAlternateVersions(title) {
        try {
            // Search Google Books API with more results
            const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(title)}&maxResults=10`);
            const data = await response.json();
            
            if (!data.items) return [];

            return data.items.map(item => {
                const volumeInfo = item.volumeInfo;
                return {
                    id: item.id,
                    title: volumeInfo.title || 'Unknown Title',
                    authors: volumeInfo.authors || ['Unknown Author'],
                    publishedDate: volumeInfo.publishedDate || 'Unknown Date',
                    isbn: volumeInfo.industryIdentifiers?.[0]?.identifier || 'N/A',
                    thumbnail: volumeInfo.imageLinks?.thumbnail || '',
                    description: volumeInfo.description || 'No description available.',
                    pageCount: volumeInfo.pageCount || 'Unknown',
                    publisher: volumeInfo.publisher || 'Unknown Publisher'
                };
            });
        } catch (error) {
            console.error('Error searching for alternate versions:', error);
            return [];
        }
    }

    createLoadingModal(message) {
        const modal = document.createElement('div');
        modal.className = 'replace-modal';
        modal.innerHTML = `
            <div class="replace-modal-content" style="text-align: center; max-width: 400px;">
                <h2>🔍 Searching...</h2>
                <p>${message}</p>
                <div style="margin: 20px 0;">
                    <div style="border: 4px solid #f3f3f3; border-top: 4px solid #007bff; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto;"></div>
                </div>
            </div>
        `;
        
        // Add CSS animation for spinner
        if (!document.querySelector('#spinner-style')) {
            const style = document.createElement('style');
            style.id = 'spinner-style';
            style.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
        
        return modal;
    }

    showReplacementModal(currentBook, alternateBooks, bookIndex) {
        const modal = document.createElement('div');
        modal.className = 'replace-modal';
        modal.innerHTML = `
            <div class="replace-modal-content">
                <h2>🔄 Replace "${currentBook.title}"</h2>
                <p>Select the correct version of this book:</p>
                
                <div class="book-options">
                    ${alternateBooks.map((book, index) => `
                        <div class="book-option" data-book-index="${index}">
                            ${book.thumbnail ? `<img src="${book.thumbnail}" alt="${book.title}">` : '<div style="width: 60px; height: 80px; background: #e9ecef; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 24px;">📚</div>'}
                            <div class="book-option-info">
                                <h4>${book.title}</h4>
                                <p><strong>Author(s):</strong> ${book.authors.join(', ')}</p>
                                <p><strong>Published:</strong> ${book.publishedDate}</p>
                                <p><strong>Publisher:</strong> ${book.publisher}</p>
                                ${book.isbn !== 'N/A' ? `<p><strong>ISBN:</strong> ${book.isbn}</p>` : ''}
                                ${book.pageCount !== 'Unknown' ? `<p><strong>Pages:</strong> ${book.pageCount}</p>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <div class="replace-modal-buttons">
                    <button class="btn-replace-cancel" onclick="bookshelfScanner.closeReplaceModal()">Cancel</button>
                    <button class="btn-replace-confirm" id="confirmReplace" disabled onclick="bookshelfScanner.confirmReplacement(${bookIndex})">Replace Book</button>
                </div>
            </div>
        `;

        // Add click handlers for book options
        modal.querySelectorAll('.book-option').forEach((option, index) => {
            option.addEventListener('click', () => {
                // Remove previous selection
                modal.querySelectorAll('.book-option').forEach(opt => opt.classList.remove('selected'));
                // Select this option
                option.classList.add('selected');
                // Enable confirm button
                modal.querySelector('#confirmReplace').disabled = false;
                // Store selected book data
                modal.selectedBookData = alternateBooks[index];
            });
        });

        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeReplaceModal();
            }
        });

        this.currentReplaceModal = modal;
        document.body.appendChild(modal);
    }

    closeReplaceModal() {
        if (this.currentReplaceModal) {
            document.body.removeChild(this.currentReplaceModal);
            this.currentReplaceModal = null;
        }
    }

    confirmReplacement(bookIndex) {
        if (!this.currentReplaceModal || !this.currentReplaceModal.selectedBookData) {
            return;
        }

        const newBookData = this.currentReplaceModal.selectedBookData;
        const oldBook = this.library[bookIndex];
        
        // Preserve original metadata (position, date added, etc.)
        const updatedBook = {
            ...newBookData,
            id: oldBook.id,
            addedDate: oldBook.addedDate,
            photoPosition: oldBook.photoPosition,
            photoFileName: oldBook.photoFileName,
            photoDate: oldBook.photoDate
        };

        // Replace the book in the library
        this.library[bookIndex] = updatedBook;
        this.saveLibrary();
        this.updateLibraryDisplay();
        this.closeReplaceModal();

        // Show success message
        alert(`Successfully replaced with "${newBookData.title}" by ${newBookData.authors.join(', ')}`);
    }

    async saveLibrary() {
        if (!this.currentUser) {
            console.warn('Cannot save library: user not authenticated');
            return;
        }
        
        // Always save to localStorage as backup
        const libraryKey = `user-${this.currentUser.uid}-library`;
        try {
            localStorage.setItem(libraryKey, JSON.stringify(this.library));
            console.log(`Saved ${this.library.length} books to localStorage backup`);
        } catch (error) {
            console.error('Failed to save to localStorage:', error);
        }
        
        // Try to save to Firestore if available
        if (!window.db) {
            console.warn('Firestore not available, using localStorage only');
            return;
        }
        
        try {
            const userDocRef = window.doc(window.db, 'users', this.currentUser.uid);
            await window.setDoc(userDocRef, {
                email: this.currentUser.email,
                library: this.library,
                updatedAt: new Date().toISOString()
            }, { merge: true });
            
            console.log(`✅ Saved ${this.library.length} books to Firestore for user: ${this.currentUser.email}`);
        } catch (error) {
            console.error('Error saving library to Firestore:', error);
            
            if (error.message.includes('offline') || error.message.includes('unavailable')) {
                console.log('📱 Firestore offline - data saved to localStorage. Will sync when connection is restored.');
            } else {
                console.log('⚠️ Firestore error - using localStorage only for now');
            }
        }
    }
    
    async uploadPhotoToStorage(imageDataUrl, fileName) {
        if (!this.currentUser) {
            console.warn('Cannot upload photo: user not authenticated');
            return null;
        }
        
        if (!window.storage) {
            console.warn('Firebase Storage not available, skipping photo upload');
            return null;
        }
        
        try {
            // Convert data URL to blob
            const response = await fetch(imageDataUrl);
            const blob = await response.blob();
            
            // Create storage reference
            const photoRef = window.ref(window.storage, `users/${this.currentUser.uid}/photos/${fileName}`);
            
            // Upload the photo
            const snapshot = await window.uploadBytes(photoRef, blob);
            
            // Get download URL
            const downloadURL = await window.getDownloadURL(snapshot.ref);
            
            console.log(`✅ Photo uploaded successfully: ${downloadURL}`);
            return downloadURL;
        } catch (error) {
            console.error('Error uploading photo to Firebase Storage:', error);
            
            if (error.message.includes('offline') || error.message.includes('unavailable')) {
                console.log('📱 Firebase Storage offline - photo will be uploaded when connection is restored');
            } else {
                console.log('⚠️ Firebase Storage error - photo upload failed');
            }
            
            return null;
        }
    }
    
    async addBookWithPhoto(bookData, photoDataUrl, photoFileName) {
        // Upload photo first
        const photoURL = await this.uploadPhotoToStorage(photoDataUrl, photoFileName);
        
        // Add book to library with photo URL
        const bookWithPhoto = {
            ...bookData,
            id: Date.now().toString(),
            addedDate: new Date().toISOString(),
            photoURL: photoURL,
            photoFileName: photoFileName
        };
        
        this.library.push(bookWithPhoto);
        await this.saveLibrary();
        this.updateLibraryDisplay();
        
        return bookWithPhoto;
    }
    
    // Navigation Methods
    switchToSection(section) {
        // Remove active class from all tabs
        this.scannerTab.classList.remove('active');
        this.libraryTab.classList.remove('active');
        this.photosTab.classList.remove('active');
        
        // Hide all sections
        this.scannerSection.style.display = 'none';
        this.librarySection.style.display = 'none';
        this.photosSection.style.display = 'none';
        
        // Show selected section and activate tab
        switch(section) {
            case 'scanner':
                this.scannerTab.classList.add('active');
                this.scannerSection.style.display = 'block';
                break;
            case 'library':
                this.libraryTab.classList.add('active');
                this.librarySection.style.display = 'block';
                this.updateLibraryDisplay();
                break;
            case 'photos':
                this.photosTab.classList.add('active');
                this.photosSection.style.display = 'block';
                this.updatePhotosDisplay();
                break;
        }
    }
    
    updatePhotosDisplay() {
        if (!this.photosGrid) return;
        
        // Get unique photos from library
        const photoMap = new Map();
        this.library.forEach(book => {
            if (book.photoURL && book.photoFileName) {
                if (!photoMap.has(book.photoURL)) {
                    photoMap.set(book.photoURL, {
                        url: book.photoURL,
                        fileName: book.photoFileName,
                        books: [],
                        scanDate: book.addedDate
                    });
                }
                photoMap.get(book.photoURL).books.push(book);
            }
        });
        
        const photos = Array.from(photoMap.values());
        this.photoCount.textContent = photos.length;
        
        if (photos.length === 0) {
            this.photosGrid.innerHTML = `
                <div class="empty-photos">
                    <p>No photos scanned yet. Start by scanning your first bookshelf!</p>
                </div>
            `;
            } else {
            this.photosGrid.innerHTML = photos.map(photo => `
                <div class="photo-card">
                    <img src="${photo.url}" alt="Bookshelf photo" onclick="bookshelfScanner.showPhotoViewer('${photo.url}', ${JSON.stringify(photo.books).replace(/"/g, '&quot;')})">
                    <div class="photo-info">
                        <h4>Scan from ${new Date(photo.scanDate).toLocaleDateString()}</h4>
                        <p>${photo.books.length} book${photo.books.length > 1 ? 's' : ''} detected</p>
                        <p>${photo.fileName}</p>
                    </div>
                    <div class="photo-actions">
                        <button class="btn btn-primary" onclick="bookshelfScanner.showPhotoViewer('${photo.url}', ${JSON.stringify(photo.books).replace(/"/g, '&quot;')})">
                            <span class="icon">👁️</span>
                            View Details
                        </button>
                    </div>
                </div>
            `).join('');
        }
    }
    
    showPhotoViewer(photoURL, books) {
        const modal = document.createElement('div');
        modal.className = 'photo-viewer-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 2000;
        `;
        
        modal.innerHTML = `
            <div style="max-width: 90vw; max-height: 90vh; position: relative;">
                <button class="modal-close" style="
                    position: absolute;
                    top: -40px;
                    right: 0;
                    background: white;
                    border: none;
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    font-size: 24px;
                    cursor: pointer;
                    color: #333;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">×</button>
                
                <img src="${photoURL}" style="max-width: 100%; max-height: 100%; border-radius: 8px;">
                
                <div style="
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    background: linear-gradient(transparent, rgba(0,0,0,0.8));
                    color: white;
                    padding: 2rem;
                    border-radius: 0 0 8px 8px;
                ">
                    <h3 style="margin: 0 0 1rem 0;">Books Found in This Photo (${books.length})</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem;">
                        ${books.map(book => `
                            <div style="background: rgba(255,255,255,0.1); padding: 1rem; border-radius: 8px;">
                                <h4 style="margin: 0 0 0.5rem 0; font-size: 0.9rem;">${book.title}</h4>
                                <p style="margin: 0; font-size: 0.8rem; opacity: 0.8;">${book.authors.join(', ')}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        
        // Close modal functionality
        modal.querySelector('.modal-close').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
        
        document.body.appendChild(modal);
    }
    
    findBookPhoto(bookIndex) {
        const book = this.library[bookIndex];
        if (!book || !book.photoURL) {
            alert('No photo available for this book.');
            return;
        }
        
        // Find all books from the same photo
        const booksFromSamePhoto = this.library.filter(b => b.photoURL === book.photoURL);
        
        this.showPhotoViewer(book.photoURL, booksFromSamePhoto);
    }

    exportLibrary() {
        if (this.library.length === 0) {
            alert('No books to export!');
            return;
        }
        
        const exportData = this.library.map(book => ({
            title: book.title,
            authors: book.authors.join(', '),
            isbn: book.isbn,
            publishedDate: book.publishedDate,
            addedDate: new Date(book.addedDate).toLocaleDateString(),
            source: book.source || 'Bookshelf Scanner'
        }));
        
        const csvHeader = 'Title,Authors,ISBN,Published,Added,Source\n';
        const csvContent = exportData.map(book => 
            `"${book.title}","${book.authors}","${book.isbn}","${book.publishedDate}","${book.addedDate}","${book.source}"`
        ).join('\n');
        
        const csvBlob = new Blob([csvHeader + csvContent], { type: 'text/csv' });
        const csvUrl = URL.createObjectURL(csvBlob);
        
        const a = document.createElement('a');
        a.href = csvUrl;
        a.download = 'bookshelf-library.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(csvUrl);
        
        alert('Library exported as CSV file!');
    }

    clearLibrary() {
        if (confirm('Are you sure you want to clear your entire library? This cannot be undone.')) {
            this.library = [];
            this.saveLibrary();
            this.updateLibraryDisplay();
            alert('Library cleared successfully!');
        }
    }
}

// Initialize the application when the page loads
let authManager;
let bookshelfScanner;

document.addEventListener('DOMContentLoaded', () => {
    authManager = new AuthManager();
    console.log('Authentication system initialized');
});