
const BACKEND_URL = "https://chrome-extension-code-explainer-ver.vercel.app";


function looksLikeCode(text) {
  const symbolPattern = /[{}();=\[\].,:<>&|+\-*/%!^~]/;
  const keywordPattern = new RegExp(
    `\\b(function|def|class|interface|extends|implements|const|let|var|public|private|static|await|async|yield|package|module|typeof|instanceof|debugger|delete|in|voidof|enum|struct|union)\\b`,
    `i`
  );
  const hasStrongSymbols = symbolPattern.test(text);
  const hasStrongKeywords = keywordPattern.test(text);
  const containsMultipleSymbols = (text.match(/[{}();=\[\].,:<>&|+\-*/%!^~]/g) || []).length >= 3;
  return (hasStrongSymbols && hasStrongKeywords) || containsMultipleSymbols;
}


async function loginWithGoogle() {
  try {
    const token = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, function(token) {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError.message);
        } else {
          resolve(token);
        }
      });
    });
    console.log("Token returned is:", token);
    // send google token to backend and store session token
    const response = await fetch(`${BACKEND_URL}/api/auth/google-chrome-extension`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ idToken: token })
    });
    console.log("Backend response:", response);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || response.statusText);
    }

    const data = await response.json();
    const sessionToken = data.sessionToken;

    await chrome.storage.local.set({ 'backendSessionToken': sessionToken });
    return { success: true };

  } catch (error) {
    console.error("Login process failed:", error);
    return { success: false, error: error.message || "Login failed" };
  }
}

async function explainCodeWithBackend(code) {
  // const sessionToken = (await chrome.storage.local.get('backendSessionToken')).backendSessionToken;
  
  // if (!sessionToken) {
  //   return { error: 'Not authenticated. Please log in first.' };
  // }
  console.log("Selected text being sent:", code);
  try {
    const response = await fetch(`${BACKEND_URL}/api/explain-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        //'Authorization': `Bearer ${sessionToken}` // Send your session token for authentication
      },
      body: JSON.stringify({ code: code })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || response.statusText);
    }

    const data = await response.json();
    return { explanation: data.explanation };
  } catch (error) {
    console.error("Error communicating with backend:", error);
    return { error: `Service error: ${error.message || 'Could not get explanation.'}` };
  }
}

// listener for messages from content.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'explainCode' && message.code) {
    explainCodeWithBackend(message.code).then(sendResponse);
    return true;
  } else if (message.type === 'initiateLogin') {
    loginWithGoogle().then(sendResponse);
    return true;
  }
});