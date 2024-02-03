//
//  SidebarView.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 2/1/24.
//

import SwiftUI

struct SidebarView<Content: View>: View {

    let content: Content // Define a property to hold the custom content
    
    // Add an initializer to accept the custom content
    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }
    
    @EnvironmentObject var vm: ViewModel
    
   
    
    var body: some View {
        ZStack{
            content
                .padding(.leading, vm.sidebarOpened ? UIScreen.main.bounds.width/2 : 50)
                .gesture(
                    DragGesture()
                        .onEnded { value in
                            // Detect left to right swipe to open sidebar
                            if value.translation.width > 100 && abs(value.translation.height) < 100 {
                                withAnimation {
                                    vm.sidebarOpened = true
                                }
                            }
                        }
              
                )

            HStack{
                
                Rectangle()
                    .ignoresSafeArea()
                    .foregroundStyle(.sidebarDefault)
                    .frame(width: vm.sidebarOpened ? UIScreen.main.bounds.width/2 : 50)
                    .gesture(
                        DragGesture()
                            .onEnded { value in
                                // Check for left to right swipe
                                if value.translation.width > 100 && abs(value.translation.height) < 100 {
                                    withAnimation {
                                        vm.sidebarOpened.toggle()
                                    }
                                }
                            }
                    )
                    .overlay(alignment: vm.sidebarOpened ? .topLeading : .top) {
                        VStack(alignment: vm.sidebarOpened ? .leading : .center){
                            HStack{
                                Image("logo-color")
                                    .resizable()
                                    .frame(width: 36, height: 36)
                                
                                if vm.sidebarOpened {
                                    Text("PhotoAura")
                                        .font(.custom(Lato, size: 20))
                                        .lineSpacing(28)
                                        .fontWeight(.bold)
                                }
                            }
                            
                            
                            .onTapGesture {
                                withAnimation {
                                    vm.sidebarOpened.toggle()
                                }
                            }
                            
                            .padding(.bottom)
                            
                            SidebarNavButton(tab: .photos, tabText: "Photos")
                            
                            SidebarNavButton(tab: .albums, tabText: "Albums")
                            
                            Spacer()
                            SidebarNavButton(tab: .settings, tabText: "Settings")
                            SidebarNavButton(tab: .logout, tabText: "Logout")
                            
                            
                            
                            
                        }   .padding(.horizontal)
                    }
                
                
                
                
                
                Spacer()
            
        }
        }
    }
}

#Preview {
    ContentView()
    .environmentObject(ViewModel())
}


struct SidebarNavButton : View {
    
    @State var tab: Tab
    @State var tabText: String
    @EnvironmentObject var vm: ViewModel
    
    @State var showLogoutAlert: Bool = false
    var body: some View {
        
        Button{
            
            if tab != .logout {
                vm.currentTab = tab
            }else {
                showLogoutAlert = true
            }
        } label: {
            HStack{
                Image(systemName: tab.rawValue)
                    .fontWeight(.medium)
                    .foregroundStyle(vm.currentTab == tab ? .textDefault : .textDefault.opacity(0.7))
                    .frame(width: 36, height: 36)
                    .cornerRadius(4.0)
                    .offset(x: tab == .logout ? 1.9  : 0)
                
                if vm.sidebarOpened {
                    Text(tabText)
                        .font(.custom(Lato, size: 16))
                        .lineSpacing(24)
                        .fontWeight(.bold)
                    .foregroundStyle(vm.currentTab == tab ? .textDefault : .textDefault.opacity(0.7))                }
                
                
            }
           
           
            
            
        }
        .alert("Are you sure you want to logout?", isPresented: $showLogoutAlert){
            Button("Cancel", role: .cancel){
                showLogoutAlert = false
            }
            
            Button("Log out", role: .destructive){
                vm.logout()
            }
        }
        
    }
}
