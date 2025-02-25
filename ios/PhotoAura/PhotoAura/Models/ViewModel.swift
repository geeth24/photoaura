//
//  ViewModel.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 1/31/24.
//

import Foundation
import SwiftUI
import Security

extension AlbumsModel {
    init() {
        self.albumId = 0
        self.albumName = ""
        self.slug = ""
        self.upload = false
        self.imageCount = 0
        self.albumPhotos = []
    }
}

class ViewModel: NSObject, ObservableObject {
    
    
    @AppStorage("photoAuraURL") var photoAuraURL: String = ""
    @AppStorage("sidebarOpened") var sidebarOpened = false
    @AppStorage("token") var token = ""
    @Published var shareLink = ""
    
    @Published var loggedIn = false
    @Published var isLoading = true
    
    @Published var photos: [PhotosModel] = []
    @Published var albums: [AlbumsModel] = []
    @Published var album: AlbumsModel = AlbumsModel()
    
    @Published var currentTab: Tab = .home
    @Published var showLogoutAlert: Bool = false
    @Published var showDeleteAlert: Bool = false
    
    @Published var showErrorAlert: Bool = false
    @Published var errorText: String = ""
    
    @Published var changeURL: Bool = false
    
    @Published var currentPage = 1
    @Published var hasMoreData = true
    private let pageSize = 20 // Number of items per page

    
    private let defaults = UserDefaults.standard
    
    // Keychain access for secure storage
    private func saveToKeychain(key: String, data: Data) -> OSStatus {
        let query = [
            kSecClass as String: kSecClassGenericPassword as String,
            kSecAttrAccount as String: key,
            kSecValueData as String: data] as [String: Any]
        
        SecItemDelete(query as CFDictionary)
        return SecItemAdd(query as CFDictionary, nil)
    }
    
    
    
    private func loadFromKeychain(key: String) -> Data? {
        let query = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecReturnData as String: kCFBooleanTrue!,
            kSecMatchLimit as String: kSecMatchLimitOne] as [String: Any]
        
        var item: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == noErr {
            return item as? Data
        }
        return nil
    }
    
    private var username: String {
        get {
            if let userData = loadFromKeychain(key: "username") {
                return String(decoding: userData, as: UTF8.self)
            }
            return ""
        }
        set {
            if let data = newValue.data(using: .utf8) {
                // Explicitly ignore the result with '_ ='
                _ = saveToKeychain(key: "username", data: data)
            }
        }
    }
    
    private var password: String {
        get {
            if let passwordData = loadFromKeychain(key: "password") {
                return String(decoding: passwordData, as: UTF8.self)
            }
            return ""
        }
        set {
            if let data = newValue.data(using: .utf8) {
                // Explicitly ignore the result with '_ ='
                _ = saveToKeychain(key: "password", data: data)
            }
        }
    }
    
    
    override init() {
        super.init()
        autoLogin()
    }
    
    private func autoLogin() {
        let username = self.username // Retrieved from Keychain
        let password = self.password // Retrieved from Keychain
        
        if !username.isEmpty && !password.isEmpty {
            print(username)
            print(password)
            
            Task {
                do {
                    try await login(username: username, password: password)
                } catch {
                    print("Init login failed")
                    isLoading = false
                }
            }
        } else {
            isLoading = false
        }
    }
    
    @MainActor
    func login(username: String, password: String) async throws {
        isLoading = true
        print("photoAuraURL: \(photoAuraURL)")
        
        guard let url = URL(string: "https://\(photoAuraURL)/api/login") else {
            print("ERRR")
            isLoading = false
            
            return
        }
        
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.timeoutInterval = 10 // Timeout after 10 seconds
        
        let params = "username=\(username)&password=\(password)"
        urlRequest.httpBody = params.data(using: .utf8)
        urlRequest.addValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        
        do {
            let (data, response) = try await URLSession.shared.data(for: urlRequest)
            guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
                isLoading = false
                print("Error: HTTP response status code is not 200.")
                showErrorAlert = true
                errorText = "Invalid username or password"
                isLoading = false
                return
            }
            
            // Decode the data to your struct
            let loginResponse = try JSONDecoder().decode(LoginResponse.self, from: data)
            if let userData = try? JSONEncoder().encode(loginResponse.user) {
                defaults.set(userData, forKey: "userDetails")
            }
            
            // Save credentials in Keychain only after successful login
            saveCredentials(username: username, password: password)
            
            print("Message: \(loginResponse.message)")
            print("Access Token: \(loginResponse.accessToken)")
            token = loginResponse.accessToken
            loggedIn = true
        } catch {
            isLoading = false
            if let error = error as? URLError, error.code == .timedOut {
                print("Error: Request timed out.")
            } else {
//                changeURL = true
                print("Error making the request: \(error)")
                showErrorAlert = true
                errorText = "Invalid PhotoAura URL"
            }
        }
        
        isLoading = false
    }
    
    
    @MainActor
    func deleteUser() async throws {
        isLoading = true
        let userData = getUserDetail()
        guard let url = URL(string: "https://\(photoAuraURL)/api/users/\(userData?.id ?? 0)/delete") else {
            isLoading = false
            return
        }
        
        var urlRequest = URLRequest(url: url)
        urlRequest.setValue( "Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let (_, response) = try await URLSession.shared.data(for: urlRequest)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            isLoading = false
            print("Error: HTTP response status code is not 200.")
            return
        }
        
        logout()
        
        isLoading = false
    }
    
    private func saveCredentials(username: String, password: String) {
        if let usernameData = username.data(using: .utf8),
           let passwordData = password.data(using: .utf8) {
            let usernameSaveStatus = saveToKeychain(key: "username", data: usernameData)
            let passwordSaveStatus = saveToKeychain(key: "password", data: passwordData)
            
            // Check and handle the save status for username
            if usernameSaveStatus != errSecSuccess {
                print("Error saving username to Keychain: \(usernameSaveStatus)")
            }
            
            // Check and handle the save status for password
            if passwordSaveStatus != errSecSuccess {
                print("Error saving password to Keychain: \(passwordSaveStatus)")
            }
        }
    }
    
    func logout() {
        // Clear credentials from Keychain
        clearKeychain()
        
        // Clear user details from UserDefaults
        defaults.removeObject(forKey: "userDetails")
        
        photos = []
        albums = []
        album = AlbumsModel()
        
        // Update application state
        DispatchQueue.main.async {
            self.loggedIn = false
            self.isLoading = false
        }
    }
    
    private func clearKeychain() {
        let keys = ["username", "password"]
        for key in keys {
            let query = [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrAccount as String: key
            ] as [String: Any]
            
            let status = SecItemDelete(query as CFDictionary)
            if status != errSecSuccess && status != errSecItemNotFound {
                print("Error clearing Keychain item for key \(key): \(status)")
            }
        }
    }
    
    
    
    func getUserDetail() -> UserDetail? {
        guard let userData = defaults.data(forKey: "userDetails") else { return nil }
        return try? JSONDecoder().decode(UserDetail.self, from: userData)
    }
    
    
    @MainActor
    func getPhotos() async throws {
        isLoading = true
        
        let userData = getUserDetail()
        print("https://\(photoAuraURL)/api/photos?user_id=\(userData?.id ?? 0)")

        guard let url = URL(string: "https://\(photoAuraURL)/api/photos?user_id=\(userData?.id ?? 0)") else {
            isLoading = false
            return
        }
        
        let urlRequest = URLRequest(url: url)
        
        
        let (data, response) = try await URLSession.shared.data(for: urlRequest)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            isLoading = false
            print("Error: HTTP response status code is not 200.")
            return
        }
        
        do {
            // Decode the data to your struct
            let photosResponse = try JSONDecoder().decode([PhotosModel].self, from: data)
            self.photos = photosResponse
        } catch {
            isLoading = false
            print("Error decoding the response: \(error)")
        }
        
        isLoading = false
    }
    
    @MainActor
    func getAlbums() async throws {
        guard hasMoreData, !isLoading else { return }
        isLoading = true
        defer { isLoading = false }
        
        let userData = getUserDetail()
        guard let url = URL(string: "https://\(photoAuraURL)/api/albums?user_id=\(userData?.id ?? 0)&page=\(currentPage)&size=\(pageSize)") else {
            isLoading = false
            return
        }
        
        let urlRequest = URLRequest(url: url)
        
        let (data, response) = try await URLSession.shared.data(for: urlRequest)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            isLoading = false
            print("Error: HTTP response status code is not 200.")
            return
        }
        
        do {
            let albumsResponse = try JSONDecoder().decode([AlbumsModel].self, from: data)
            
            if albumsResponse.count < pageSize {
                hasMoreData = false // No more data to load
            }
            
            self.albums.append(contentsOf: albumsResponse)
            self.currentPage += 1
        } catch {
            print("Error decoding the response: \(error)")
        }
    }

    
    
    @MainActor
    func getAlbum(slug: String) async throws {
        isLoading = true
        guard let url = URL(string: "https://\(photoAuraURL)/api/album/\(slug)") else {
            isLoading = false
            return
        }
        
        let urlRequest = URLRequest(url: url)
        
        
        let (data, response) = try await URLSession.shared.data(for: urlRequest)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            isLoading = false
            print("Error: HTTP response status code is not 200.")
            if slug.components(separatedBy: "?")[1].starts(with: "secret") {
                shareLink = ""
                
            }
            return
        }
        
        do {
            // Decode the data to your struct
            let albumsResponse = try JSONDecoder().decode(AlbumsModel.self, from: data)
            self.album = albumsResponse
        } catch {
            isLoading = false
            print("Error decoding the response: \(error)")
        }
        
        isLoading = false
    }
    
    @MainActor
    func deletePhoto(slug: String, photoName: String) async throws {
        isLoading = true
        print("\(slug) \(photoName)")
        guard let url = URL(string: "https://\(photoAuraURL)/api/photo/delete/?slug=\(slug)&photo_name=\(photoName)") else {
            isLoading = false
            return
        }
        
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "DELETE"
        
        let (_, response) = try await URLSession.shared.data(for: urlRequest)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            isLoading = false
            print("Error: HTTP response status code is not 200.")
            return
        }
        
        
        isLoading = false
    }
    
    
}
