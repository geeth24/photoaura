//
//  ContentView.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 1/31/24.
//

let Lato = "Lato"

enum Tab: String, CaseIterable{
    
    case home = "house"
//    case photos = "photo"
//    case albums = "photo.stack.fill"
    case settings = "gear"
    case logout = "rectangle.portrait.and.arrow.forward"
}


import SwiftUI

struct ContentView: View {
    @EnvironmentObject var vm: ViewModel
    init(){
        
        UITabBar.appearance().isHidden = true
    }
    
    @State var currentTab: Tab = .home
    @State private var scrollOffset: CGFloat = 0

    var body: some View {
        NavigationStack {
            
            VStack{
                if vm.loggedIn {
                    SidebarView {
                        TabView(selection: $vm.currentTab){
                        
                            GeometryReader { geometry in
                                       let size = geometry.size
                                       let safeArea = geometry.safeAreaInsets
                                       let screenHeight = size.height + safeArea.top + safeArea.bottom
                                       let minimisedHeight = screenHeight * 0.3
                                       
                                       ScrollView {
                                           VStack(spacing: 0) {
                                               // Photos View: Adjusts dynamically based on scroll offset
                                               PhotosView()
                                                   .frame(height: max(screenHeight - scrollOffset, minimisedHeight) - 100)
                                                   .animation(.easeInOut(duration: 0.3), value: scrollOffset)
                                
                                               
                                               // Albums View: Always takes the remaining space
                                               AlbumsView()
                                           }
                                       }
                                       .defaultScrollAnchor(.bottom)
                                       .background(
                                           GeometryReader { proxy in
                                               Color.clear
                                                   .preference(key: ScrollOffsetPreferenceKey.self, value: -proxy.frame(in: .named("scroll")).origin.y)
                                           }
                                       )
                                       .onPreferenceChange(ScrollOffsetPreferenceKey.self) { value in
                                           scrollOffset = value
                                       }
                                       
                                   }
                                   .coordinateSpace(name: "scroll")
                                   .ignoresSafeArea(.all, edges: .top)
                                   .tag(Tab.home)
                            
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
}

#Preview {
    ContentView()
        .environmentObject(ViewModel())
}


struct ScrollOffsetPreferenceKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}

