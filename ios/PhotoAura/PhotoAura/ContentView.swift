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
            
        } else if vm.isLoading{
            ProgressView()
        } else{
            SetupView()
        }
        
        
    }
}

#Preview {
    ContentView()
        .environmentObject(ViewModel())
}
