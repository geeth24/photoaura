//
//  LoginView.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 1/31/24.
//

import SwiftUI


struct LoginView: View {
    @State private var username: String = ""
    @State private var password: String = ""
    
    @State var forgotPasswordFlag: Bool = false
    
    @FocusState var userFieldFocus: Bool
    @FocusState var passwordFieldFocus: Bool
    @EnvironmentObject var vm: ViewModel

    
    var body: some View {
        VStack {
            Image("login-image")
                .resizable()
                .aspectRatio(contentMode: .fill)
                .frame(width: UIScreen.main.bounds.width*2, height: 350)
            

            
            VStack{
                
                VStack(spacing: 4) {
                    Text("\(forgotPasswordFlag ? "Forgot Password for" : "Log in to")")
                        .font(.custom(Lato, size: 16))
                        .lineSpacing(24)
                        .foregroundStyle(.textDefault)
                    Text("PhotoAura")
                        .font(.custom(Lato, size: 30))
                        .lineSpacing(36)
                        .bold()
                        .foregroundStyle(.textDefault)
                }
                
                VStack(spacing: 16) {
                    
                    VStack(alignment: .leading, spacing: 6){
                        Text("Username")
                            .font(.custom(Lato, size: 14))
                            .fontWeight(.medium)
                            .foregroundStyle(.textDefault)
                        
                        TextField("Username", text: $username)
                            .padding(.horizontal, 12.0) // Apply horizontal padding first
                            .padding(.vertical, 4.0) // Then apply vertical padding
                            .frame(height: 36)
                        
                            .font(.custom(Lato, size: 14))
                            .lineSpacing(20)
                            .background(Color.clear) // Specify the background before the border
                            .overlay(
                                RoundedRectangle(cornerRadius: 4)
                                    .stroke(userFieldFocus ? .buttonDefault : .input, lineWidth: 1)
                            )
                            .keyboardType(.emailAddress)
                            .textContentType(.username)
                            .autocapitalization(.none)
                            .autocorrectionDisabled()
                            .focused($userFieldFocus)

                        
                    }
                    
                    
                    
                    
                    if !forgotPasswordFlag {
                        VStack(alignment: .leading, spacing: 6){
                            Text("Password")
                                .font(.custom(Lato, size: 14))
                                .fontWeight(.medium)
                                .foregroundStyle(.textDefault)
                            
                            SecureField("Password", text: $password)
                                .padding(.horizontal, 12.0) // Apply horizontal padding first
                                .padding(.vertical, 4.0) // Then apply vertical padding
                                .frame(height: 36)
                            
                                .font(.custom(Lato, size: 14))
                                .fontWeight(.medium)
                                .lineSpacing(20)
                                .background(Color.clear) // Specify the background before the border
                                .overlay(
                                    RoundedRectangle(cornerRadius: 4)
                                        .stroke(passwordFieldFocus ? .buttonDefault : .input, lineWidth: 1)
                                )
                                .textContentType(.password)
                                .autocapitalization(.none)
                                .autocorrectionDisabled()
                                .focused($passwordFieldFocus)

                            
                        }
                    }
                                        
                    
                    
                }
                .padding([.leading, .trailing], 27.5)
                .padding(.top)
                
                Button(action: {
                    // Handle login action
                    Task {
                        do {
                            try await vm.login(username: username, password: password)
                        } 
                    }
                }) {
                    Text("\(forgotPasswordFlag ? "Send Reset Link" : "Log In")")
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
                
                Button(action: {
                    // Handle forgot password action
                    forgotPasswordFlag.toggle()
                }) {
                    Text("Forgot password?")
                        .foregroundColor(.textDefault)
                        .font(.custom(Lato, size: 14))
                    
                }
                .padding(.top, 10)
                
                Spacer()
                
                
                
            }
            Spacer()
            
        }
        .edgesIgnoringSafeArea(.all)
        .alert(vm.errorText, isPresented: $vm.showErrorAlert){
            Button("Ok"){
                vm.showErrorAlert = false
            }
        }
    }
}


#Preview {
    LoginView()
        .environmentObject(ViewModel())

}
