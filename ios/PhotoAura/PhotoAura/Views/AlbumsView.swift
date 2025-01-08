//
//  AlbumsView.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 2/1/24.
//

import SwiftUI
import CachedAsyncImage

struct AlbumsView: View {
    @EnvironmentObject var vm: ViewModel
    
    init() {
        UINavigationBar.appearance().largeTitleTextAttributes = [.font: UIFont(name: "Lato-Bold", size: 36)!]
    }
    
    let columns = [
        GridItem(.flexible()),
        GridItem(.flexible())
    ]
    
    var body: some View {
        
        VStack(alignment: .leading, spacing: 10) {
            
            HStack {
                Spacer()
                Capsule()
                    .frame(width: 48, height: 8)
                    .foregroundColor(.textDefault.opacity(0.5))
                    .padding(.horizontal)
                
                Spacer()
                   
            }
            
            Text("Albums")
                .font(.custom(Lato, size: 24))
                .lineSpacing(28)
                .fontWeight(.bold)
            
            ScrollView(.horizontal) {
                LazyHStack {
                    ForEach(vm.albums, id: \.self) { album in
                        NavigationLink {
                            AlbumView(slug: album.slug)
                        } label: {
                            
                            ZStack {
                                    
                                    
                                    
                                    if let firstPhoto = album.albumPhotos.first {
                                        
                                        CachedAsyncImage(url: URL(string: firstPhoto.compressedImage)) { image in
                                            image
                                                .resizable()
                                                .scaledToFill()
                                                .frame(width: 220, height: 150)
                                                .clipped()
                                                .cornerRadius(8.0)
                                        } placeholder: {
                                            ProgressView()
                                                .frame(width: 220, height: 150)
                                                .foregroundStyle(.ultraThickMaterial) // Placeholder style
                                                .cornerRadius(8.0)
                                        }
                                        .overlay(alignment: .bottom){
                                            RoundedRectangle(cornerRadius: 0)
                                                .fill(.clear)
                                                .background(
                                                    .ultraThinMaterial
                                                )
                                                .clipShape(
                                                    .rect(
                                                            topLeadingRadius: 0,
                                                            bottomLeadingRadius: 8,
                                                            bottomTrailingRadius: 8,
                                                            topTrailingRadius: 0
                                                        )
                                                            )
                                                .frame(maxWidth: .infinity)
                                                .frame(height: 30)
                                                .clipped()
                                                .scaledToFill()
                                        }
                                        .overlay(alignment: .bottomLeading){
                                            Text(album.albumName)
                                                .font(.custom("Lato", size: 20))
                                                .lineSpacing(24)
                                                .fontWeight(.medium)
                                                .tracking(-0.025)
                                                .foregroundStyle(.textDefault)
                                                .padding(.leading, 5)
                                                .padding(.bottom, 5)
                                                

                                            
                                            
                                        }
                                        
                                        
                                            
                                            
                                        
                                    }
                                    
                                
                                
                                
                            }

                            
                        }
                    }
                    
                    if vm.isLoading {
                        ProgressView()
                            .onAppear {
                                Task {
                                    try? await vm.getAlbums()
                                }
                            }
                    }
                }
                

            }
            .scrollIndicators(.hidden)
            .cornerRadius(8.0)
            
        }
        .padding([.vertical, .leading])
        .onAppear {
            Task {
                do {
                    try await vm.getAlbums()
                } catch {
                    print("Error loading albums")
                }
            }
        }
        .cornerRadius(8.0)

        
        
    }
}

#Preview {
    AlbumsView()
        .environmentObject(ViewModel())
}
