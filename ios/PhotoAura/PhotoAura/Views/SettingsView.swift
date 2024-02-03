//
//  SettingsView.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 2/2/24.
//

import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var vm: ViewModel
    init() {
     
          UINavigationBar.appearance().largeTitleTextAttributes = [.font : UIFont(name: "Lato-Bold", size: 36)!]
          

      }
      
    @State var showDeleteAlert: Bool = false
    
    var body: some View {
        NavigationStack{
            VStack(alignment: .leading){
                if let userData = vm.getUserDetail() {
                    RoundedRectangle(cornerRadius: 4.0)
                        .frame(height: 210)
                        .foregroundStyle(.sidebarDefault)
                        .overlay(alignment: .topLeading) {
                            VStack(alignment: .leading){
                                HStack{
                                    Image(systemName: "person.crop.circle")
                                        .font(.system(size: 30))
                                        .fontWeight(.medium)
                                        .foregroundStyle(.textDefault)
                                        .frame(width: 30, height: 30)
                                        .cornerRadius(4.0)
                                   
                                }
                                .padding(.bottom)
                                Text(userData.userName)
                                    .font(.custom(Lato, size: 18))
                                    .lineSpacing(28)
                                    .foregroundStyle(.textDefault)
                                
                                Text(userData.fullName)
                                    .font(.custom(Lato, size: 18))
                                    .lineSpacing(28)
                                    .foregroundStyle(.textDefault)
                                
                                Text(userData.userEmail)
                                    .font(.custom(Lato, size: 18))
                                    .lineSpacing(28)
                                    .foregroundStyle(.textDefault)
                               
                                HStack{
                                    Spacer()
                                    Button{
                                        showDeleteAlert = true
                                    } label: {
                                        
                                        Text("Delete Account")
                                        
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
                            .padding()
                        }
                    
                  
                    
                   
                    VStack(alignment: .leading){
                        HStack{
                            Image("logo-color")
                                .resizable()
                                .frame(width: 36, height: 36)
                            
                         
                                Text("PhotoAura")
                                    .font(.custom(Lato, size: 20))
                                    .lineSpacing(28)
                                    .fontWeight(.bold)
                            
                        }
                        Text("Version \(UIApplication.appVersion ?? "") (\(UIApplication.appBuild ?? ""))")
                            .font(.custom(Lato, size: 14))
                            .lineSpacing(22)
                            .foregroundStyle(.textDefault)
                        
                        Link(destination: URL(string: "https://reactiveshots.com")!, label: {
                            Text("Contact Support")
                                .font(.custom(Lato, size: 14))
                                .lineSpacing(22)
                                .foregroundStyle(.textDefault)
                        })
                        
                    }
                    .padding(.top)
                    Spacer()
                    
                }
                
                
            }
            .padding()
            .navigationTitle("Settings")
            .alert("Are you sure you want to delete your account?", isPresented: $showDeleteAlert){
                
                Button("Cancel", role: .cancel){
                    showDeleteAlert = false
                }
                
                Button("Delete", role: .destructive){
                    Task{
                        do {
                            try await vm.deleteUser()
                        }
                    }
                }
            }
        }
    }
}

#Preview {
    SettingsView()
        .environmentObject(ViewModel())
}
