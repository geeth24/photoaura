//
//  SetupView.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 1/31/24.
//

import SwiftUI

struct SetupView: View {
    
    @AppStorage("photoAuraURL") var photoAuraURL: String = "aura.reactiveshots.com"
    @FocusState var photoAuraURLFieldFocus: Bool

    @EnvironmentObject var vm: ViewModel

    var body: some View {
        NavigationStack{
            VStack {
                Image("login-image")
                    .resizable()
                    .aspectRatio(contentMode: .fill)
                    .frame(width: UIScreen.main.bounds.width*2, height: 350)
                
                
                
                VStack{
                    
                    VStack(spacing: 4) {
                        Text("Welcome to")
                            .font(.custom(Lato, size: 16))
                            .lineSpacing(24)
                            .foregroundStyle(.textDefault)
                        Text("PhotoAura")
                            .font(.custom(Lato, size: 30))
                            .lineSpacing(36)
                            .bold()
                            .foregroundStyle(.textDefault)
                        
                    }
                }
                VStack(alignment: .leading, spacing: 6){

                    Text("PhotoAura URL")
                        .font(.custom(Lato, size: 14))
                        .fontWeight(.medium)
                        .foregroundStyle(.textDefault)
                    
                    TextField("aura.reactiveshots.com", text: $photoAuraURL)
                        .padding(.horizontal, 12.0) // Apply horizontal padding first
                        .padding(.vertical, 4.0) // Then apply vertical padding
                        .frame(height: 36)
                    
                        .font(.custom(Lato, size: 14))
                        .lineSpacing(20)
                        .background(Color.clear) // Specify the background before the border
                        .overlay(
                            RoundedRectangle(cornerRadius: 4)
                                .stroke(photoAuraURLFieldFocus ? .buttonDefault : .input, lineWidth: 1)
                        )
                        .keyboardType(.URL)
                        .textContentType(.URL)
                        .textCase(.lowercase)
                        .autocapitalization(.none)
                        .autocorrectionDisabled()
                        .focused($photoAuraURLFieldFocus)
                    
                    
                }
                .padding([.leading, .trailing], 27.5)
                .padding(.top)
                
                NavigationLink{
                    
                    LoginView()
                        .navigationBarBackButtonHidden(true)

                } label: {
                    
                
                        Text("Go")
                            .font(.custom(Lato, size: 14))
                            .fontWeight(.medium)
                            .foregroundStyle(.buttonTextDefault)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 8)
                            .frame(width: UIScreen.main.bounds.width - 55, height: 36)
                            .background(.buttonDefault)
                            .cornerRadius(4.0)
                        
                        
                        
                        
                        
                        
                    
                }
                .padding(.top, 20)
                
                Spacer()
            } .edgesIgnoringSafeArea(.all)
        }
    }
}

#Preview {
    SetupView()
        .environmentObject(ViewModel())
}
