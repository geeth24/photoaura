export const APP_STORE = "https://apps.apple.com/app/id6477320360"
export const PLAY_STORE = "https://play.google.com/store/apps/details?id=com.radsoftinc.photoaura"

// hides the other store's badge before first paint, so phones never see it flash
export const PLATFORM_SCRIPT = `(function(){try{var u=navigator.userAgent,h;if(/android/i.test(u))h="app-store";else if(/iPhone|iPad|iPod/.test(u)||(/Macintosh/.test(u)&&navigator.maxTouchPoints>1))h="play";if(h){var s=document.createElement("style");s.textContent='[data-store="'+h+'"]{display:none}';document.head.appendChild(s)}}catch(e){}})()`
