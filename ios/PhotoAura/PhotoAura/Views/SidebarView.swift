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
        ZStack {
            // Main content view with a tap gesture to close the sidebar
            content
                .gesture(
                    DragGesture()
                        .onChanged { value in
                            if value.translation.width > 0 {
                                withAnimation {
                                    vm.sidebarOpened = true
                                }
                            } else if value.translation.width < 0 {
                                withAnimation {
                                    vm.sidebarOpened = false
                                }
                            }
                        }
                )
                .overlay(
                    // Add a transparent overlay when the sidebar is open
                    Color.black.opacity(vm.sidebarOpened ? 0.3 : 0)
                        .ignoresSafeArea()
                        .onTapGesture {
                            withAnimation {
                                vm.sidebarOpened = false
                            }
                        }
                )
            
            // Sidebar container
            HStack {
                // Sidebar view
                Rectangle()
                    .ignoresSafeArea()
                    .foregroundStyle(.ultraThickMaterial)
                    .frame(width: vm.sidebarOpened ? UIScreen.main.bounds.width / 2 : 50)
                    .gesture(
                        DragGesture()
                            .onChanged { value in
                                withAnimation {
                                    if value.translation.width > 0 {
                                        vm.sidebarOpened = true
                                    } else if value.translation.width < 0 {
                                        vm.sidebarOpened = false
                                    }
                                }
                            }
                            .onEnded { value in
                                withAnimation {
                                    if value.translation.width > 100 {
                                        vm.sidebarOpened = true
                                    } else if value.translation.width < -100 {
                                        vm.sidebarOpened = false
                                    }
                                }
                            }
                    )
                    .onTapGesture {
                        withAnimation {
                            vm.sidebarOpened.toggle()
                        }
                    }
                    .overlay(alignment: vm.sidebarOpened ? .topLeading : .top) {
                        VStack(alignment: vm.sidebarOpened ? .leading : .center) {
                            HStack {
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
                            
                            SidebarNavButton(tab: .home, tabText: "Home")
                            
//                            SidebarNavButton(tab: .photos, tabText: "Photos")
//                            SidebarNavButton(tab: .albums, tabText: "Albums")
                            Spacer()
                            SidebarNavButton(tab: .settings, tabText: "Settings")
                            SidebarNavButton(tab: .logout, tabText: "Logout")
                        }
                        .padding(.horizontal)
                    }
                    .sheet(isPresented: $vm.showLogoutAlert) {
                        ActionSheet(action: "logout", icon: "rectangle.portrait.and.arrow.forward", actionText: "Are you sure you want to logout?")
                            .presentationDetents([.height(200)])
                    }
                
                Spacer()
            }
            .offset(x: vm.sidebarOpened ? 0 : -UIScreen.main.bounds.width / 2)
            .animation(.easeInOut, value: vm.sidebarOpened) // Explicit animation binding
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
    
    var body: some View {
        
        Button{
            
            if tab != .logout {
                vm.currentTab = tab
            }else {
                vm.showLogoutAlert = true
            }
            vm.sidebarOpened = false
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
        
        
    }
}


struct ActionSheet: View {
    @EnvironmentObject var vm: ViewModel
    @Environment(\.presentationMode) var presentationMode
    @State var action: String
    @State var icon: String
    @State var actionText: String
    
    var body: some View {
        VStack{
            
            Image(systemName: icon)
                .font(.system(size: 30))
                .fontWeight(.medium)
                .foregroundStyle(.textDefault)
                .padding(.bottom)
            
            Text(actionText)
                .font(.custom(Lato, size: 20))
                .multilineTextAlignment(.center)
                .lineSpacing(0)
                .fontWeight(.bold)
            
            HStack{
                Button{
                    presentationMode.wrappedValue.dismiss()
                } label: {
                    
                    Text("Cancel")
                    
                        .font(.custom(Lato, size: 14))
                        .fontWeight(.medium)
                        .foregroundStyle(.buttonTextDefault)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(.buttonDefault)
                        .cornerRadius(4.0)
                    
                }
                Button{
                    
                    if action == "logout"{
                        vm.logout()
                    }else if action == "delete"{
                        Task{
                            do {
                                try await vm.deleteUser()
                            }
                        }
                    }
                    
                } label: {
                    
                    Text(action.firstUppercased)
                    
                        .font(.custom(Lato, size: 14))
                        .fontWeight(.medium)
                        .foregroundStyle(.textDestructiveDefault)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                    
                        .background(.buttonDestructiveDefault)
                        .cornerRadius(4.0)
                    
                }
            }.padding(.top)
        }
    }
}

extension StringProtocol {
    var firstUppercased: String { prefix(1).uppercased() + dropFirst() }
    var firstCapitalized: String { prefix(1).capitalized + dropFirst() }
}
