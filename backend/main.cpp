#include <bits/stdc++.h>
#include <fstream>
using namespace std;

// Resolve data.txt next to the executable, not relative to whatever folder
// the process happens to be launched from. This is what made redirects randomly
// "not found" depending on how server.js invoked the binary.
//
// Done with plain string ops instead of <filesystem> because <filesystem>
// needs g++ 8+, and not everyone's toolchain is that new (e.g. g++ 6.3.0).
// argv[0] is whatever path the caller used to launch us (Node's execFile
// passes an absolute path), so we just strip the filename off the end.
// Handles both '/' (Linux/Mac) and '\' (Windows) separators.
string data_file_path(const string &argv0){
    size_t lastSlash = argv0.find_last_of("/\\");
    if(lastSlash == string::npos){
        // No directory component at all -- executable was launched from
        // the current directory, e.g. "./main". Just use data.txt as-is.
        return "data.txt";
    }
    string dir = argv0.substr(0, lastSlash);
    char sep = argv0[lastSlash];
    return dir + sep + "data.txt";
}

class urlshortener{
private:
    unordered_map<string,uint64_t> url_to_id;
    vector<string> id_to_url;
    string data_path;
    const string chars="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    string encode(uint64_t id){
        if(id==0) return "0";
        string short_url;
        while(id>0){
            short_url+=chars[id%62];
            id/=62;
        }
        reverse(short_url.begin(),short_url.end());
        return short_url;
    }
    uint64_t decode(const string &short_url){
        uint64_t id=0;
        for(char c: short_url){
            id*=62;
            if(c>='0' && c<='9'){
                id+=c-'0';
            }else if(c>='A' && c<='Z'){
                id+=c-'A'+10;
            }else if(c>='a' && c<='z'){
                id+=c-'a'+36;
            }
        }
        return id;
    }
public:
    void load_data(){
        ifstream fin(data_path);
        string line;
        while(getline(fin,line)){
            if(line.empty()) continue;
            // Strip a trailing \r in case data.txt ever gets opened/saved on Windows.
            if(!line.empty() && line.back()=='\r') line.pop_back();
            uint64_t id=0;
            string url="";
            bool sep=false;
            for(char c : line){
                if(c=='|'){
                    sep=true;
                    continue;
                }
                if(!sep)id=id*10+(c-'0');
                else url+=c;
            }
            // Keep id_to_url dense/in sync with the id, in case the file
            // ever has gaps or out-of-order lines.
            if(id_to_url.size()<=id) id_to_url.resize(id+1);
            id_to_url[id]=url;
            url_to_id[url]=id;
        }
    }
    urlshortener(const string &dataPath){
        data_path = dataPath;
        load_data();
    }
    void save_to_file(uint64_t id, const string &url){
        ofstream fout(data_path,ios::app);
        fout<<id<<"|"<<url<<"\n";
    }
    string shorten(const string &url){
        if(url_to_id.find(url)!=url_to_id.end())return encode(url_to_id[url]);
        uint64_t id=id_to_url.size();
        url_to_id[url]=id;
        id_to_url.push_back(url);
        save_to_file(id,url);
        return encode(id);
    }
    string redirect(const string &shorturl){
        uint64_t id = decode(shorturl);
        if(id>=id_to_url.size())return "";
        return id_to_url[id];
    }
};
int main(int argc, char* argv[]){
    if(argc<3){
        cout << "Usage:\n";
        cout << "main.exe shorten <url>\n";
        cout << "main.exe redirect <shortcode>\n";
        return 0;
    }
    string dataPath = data_file_path(argv[0]);
    urlshortener us(dataPath);
    string command = argv[1];
    if(command=="shorten"){
        string url=argv[2];
        if(url.empty()){
            cout << "" << endl;
            return 0;
        }
        string shorturl = us.shorten(url);
        cout<<shorturl<<endl;
    }
    else if(command=="redirect"){
        string shorturl=argv[2];
        string url=us.redirect(shorturl);
        cout<<url<<endl;
    }
    else cout<<"unnknown command"<<endl;
    return 0;
}