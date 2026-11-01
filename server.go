package main

import (
	"io"
	"log"
	"net/http"
)

func main() {
	mux := http.NewServeMux()

	// 1. Endpoint Proxy untuk NASA JPL Horizons
	mux.HandleFunc("/api/horizons.api", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		if r.Method == "OPTIONS" {
			return
		}

		nasaURL := "https://ssd.jpl.nasa.gov/api/horizons.api?" + r.URL.RawQuery
		resp, err := http.Get(nasaURL)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadGateway)
			return
		}
		defer resp.Body.Close()

		w.Header().Set("Content-Type", resp.Header.Get("Content-Type"))
		io.Copy(w, resp.Body)
	})

	// 2. Melayani file statis dari folder "public"
	fs := http.FileServer(http.Dir("./public"))
	mux.Handle("/", http.StripPrefix("/", fs))

	// Menjalankan server di port 8080 (Aman dari bentrok port sistem)
	port := ":8080"
	log.Printf("Server terpadu Go berjalan di http://0.0.0.0%s", port)

	if err := http.ListenAndServe(port, mux); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}
