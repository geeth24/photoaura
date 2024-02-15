//
//  ContentView.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 1/31/24.
//

let Lato = "Lato"

enum Tab: String, CaseIterable{
    
    case photos = "photo"
    case albums = "photo.stack.fill"
    case settings = "gear"
    case logout = "rectangle.portrait.and.arrow.forward"
}


import SwiftUI

struct ContentView: View {
    @EnvironmentObject var vm: ViewModel
    init(){
        
        UITabBar.appearance().isHidden = true
    }
    
    @State var currentTab: Tab = .photos
    
    var body: some View {
        VStack{
            if vm.loggedIn {
                SidebarView {
                    TabView(selection: $vm.currentTab){
                        PhotosView()
                            .tag(Tab.photos)
                        
                        AlbumsView()
                            .tag(Tab.albums)
                        
                        SettingsView()
                            .tag(Tab.settings)
                    }
                }
                
            } else if (vm.shareLink != "") {
                AlbumView(slug: vm.shareLink.components(separatedBy: "/")[0] + "/" + vm.shareLink.components(separatedBy: "/")[1] + "/?secret=" + vm.shareLink.components(separatedBy: "/")[2])
            }
            
            else if vm.isLoading{
                ProgressView()
            } else{
                if vm.photoAuraURL == "" || vm.changeURL {
                    SetupView()
                }else{
                    LoginView()
                }
            }
            
            
        }                .onOpenURL(perform: { url in
            // Print the received URL for debugging
            print("Received URL: \(url.absoluteString)")
            // Print the scheme specifically for debugging
            print("URL scheme received: \(String(describing: url.scheme))")
            
            // Compare the URL scheme in a case-insensitive manner
            if url.scheme?.lowercased() == "photoaura" {
                guard let components = URLComponents(url: url, resolvingAgainstBaseURL: true),
                      let queryItems = components.queryItems else {
                    print("URL does not contain any query items.")
                    return
                }
                
                // Extract the 'url' and 'shareLink' parameters from the URL
                if let auraURL = queryItems.first(where: { $0.name == "url" })?.value,
                   let shareLink = queryItems.first(where: { $0.name == "shareLink" })?.value {
                    // Use the 'auraURL' and 'shareLink' values as needed
                    print("Aura URL: \(auraURL)")
                    UserDefaults.standard.set(auraURL, forKey: "photoAuraURL")
                    
                    print("Share Link: \(shareLink)")
                    vm.shareLink = shareLink
                } else {
                    print("Missing parameters in the URL.")
                }
            } else {
                print("URL scheme does not match.")
            }
        })
        
    }
}

#Preview {
    ContentView()
        .environmentObject(ViewModel())
}
