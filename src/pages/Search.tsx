// @ts-nocheck
import { useState, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Profile } from '@/types/database';
import { Search as SearchIcon, MessageCircle, UserPlus, Hash, Users, Camera, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ScanResult {
  profile: Profile;
  similarity: number;
}

const Search = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  
  // Camera scan states
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [hasScanResult, setHasScanResult] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    setHasSearched(true);
    setHasScanResult(false);

    try {
      let queryBuilder = supabase
        .from('public_profiles')
        .select('*')
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%,user_id_code.ilike.%${query}%`)
        .limit(20);

      if (user) {
        queryBuilder = queryBuilder.neq('id', user.id);
      }

      const { data, error } = await queryBuilder;
      if (error) throw error;
      
      const filteredData = (data || []).filter(p => !p.is_banned);
      setResults(filteredData as Profile[]);
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleCameraScan = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImageSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';

    setIsScanning(true);
    setHasScanResult(false);
    setHasSearched(false);
    setScanResults([]);

    try {
      // Convert uploaded image to base64
      const searchImageBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      // Fetch all profiles with avatars
      const { data: profiles, error: profilesError } = await supabase
        .from('public_profiles')
        .select('*')
        .not('avatar_url', 'is', null);

      if (profilesError) throw profilesError;

      const profilesWithAvatars = (profiles || [])
        .filter(p => p.avatar_url && !p.is_banned && p.id !== user?.id);

      if (profilesWithAvatars.length === 0) {
        toast({ title: 'Không tìm thấy', description: 'Không có tài khoản nào có avatar để so sánh.' });
        setIsScanning(false);
        setHasScanResult(true);
        return;
      }

      // Send to edge function
      const avatars = profilesWithAvatars.slice(0, 20).map(p => ({
        id: p.id,
        url: p.avatar_url!,
      }));

      const { data: funcData, error: funcError } = await supabase.functions.invoke('avatar-scan', {
        body: { searchImageBase64, avatars },
      });

      if (funcError) throw funcError;

      const aiResults = funcData?.results || [];
      
      // Map results to profiles
      const profileMap = new Map(profilesWithAvatars.map(p => [p.id, p]));
      const matched: ScanResult[] = aiResults
        .filter((r: any) => r.similarity >= 30 && profileMap.has(r.id))
        .map((r: any) => ({
          profile: profileMap.get(r.id) as Profile,
          similarity: r.similarity,
        }))
        .sort((a: ScanResult, b: ScanResult) => b.similarity - a.similarity);

      setScanResults(matched);
      setHasScanResult(true);

      if (matched.length === 0) {
        toast({ title: 'Không tìm thấy', description: 'Không tìm thấy tài khoản tương tự.' });
      }
    } catch (error: any) {
      console.error('Error scanning avatar:', error);
      toast({ title: 'Lỗi', description: 'Không thể quét ảnh. Vui lòng thử lại.', variant: 'destructive' });
    } finally {
      setIsScanning(false);
    }
  }, [user]);

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl gradient-primary flex items-center justify-center shadow-glow">
            <Users className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Tìm kiếm bạn bè</h1>
          <p className="text-muted-foreground">
            Tìm người dùng theo tên, ID hoặc quét avatar
          </p>
        </div>

        {/* Friends List Button */}
        <div className="flex justify-center">
          <Button
            onClick={() => navigate('/friends')}
            variant="outline"
            className="rounded-xl gap-2"
          >
            <Users className="w-4 h-4" />
            Danh sách bạn bè
          </Button>
        </div>

        {/* Search Bar */}
        <div className="glass rounded-2xl p-6 animate-fade-in">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Nhập tên người dùng hoặc ID..."
                className="pl-12 pr-12 h-12 rounded-xl bg-secondary/50 text-lg"
              />
              {/* Camera button inside search bar */}
              <button
                onClick={handleCameraScan}
                disabled={isScanning}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-secondary/80 transition-colors text-muted-foreground hover:text-foreground"
                title="Quét avatar bằng ảnh"
              >
                {isScanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageSelected}
                className="hidden"
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={isSearching || !query.trim()}
              className="h-12 px-6 rounded-xl gradient-primary shadow-glow"
            >
              {isSearching ? 'Đang tìm...' : 'Tìm kiếm'}
            </Button>
          </div>
        </div>

        {/* Scanning State */}
        {isScanning && (
          <div className="glass rounded-2xl p-8 text-center animate-fade-in">
            <Loader2 className="w-12 h-12 mx-auto mb-3 text-primary animate-spin" />
            <p className="text-muted-foreground font-medium">Đang quét avatar...</p>
            <p className="text-sm text-muted-foreground mt-1">AI đang so sánh hình ảnh với các tài khoản</p>
          </div>
        )}

        {/* Scan Results */}
        {hasScanResult && !isScanning && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">
              {scanResults.length > 0
                ? `Tìm thấy ${scanResults.length} kết quả tương tự`
                : 'Không tìm thấy kết quả phù hợp'}
            </h2>

            {scanResults.length > 0 ? (
              <div className="space-y-3">
                {scanResults.map((result) => (
                  <Link
                    key={result.profile.id}
                    to={`/profile/${result.profile.id}`}
                    className="glass rounded-2xl p-4 flex items-center gap-4 hover-lift animate-fade-in block"
                  >
                    <Avatar className="h-14 w-14 ring-2 ring-primary/20">
                      <AvatarImage src={result.profile.avatar_url || ''} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                        {(result.profile.display_name || result.profile.username)?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg truncate">
                        {result.profile.display_name || result.profile.username}
                      </h3>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Hash className="w-3 h-3" />
                          <span>{result.profile.user_id_code}</span>
                        </div>
                        <span className={cn(
                          'text-xs font-bold px-2 py-0.5 rounded-full',
                          result.similarity >= 80 ? 'bg-green-500/15 text-green-600 dark:text-green-400' :
                          result.similarity >= 50 ? 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400' :
                          'bg-orange-500/15 text-orange-600 dark:text-orange-400'
                        )}>
                          {result.similarity}% giống
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="rounded-xl gap-1 gradient-primary"
                      onClick={(e) => {
                        e.preventDefault();
                        window.location.href = `/profile/${result.profile.id}`;
                      }}
                    >
                      <UserPlus className="w-4 h-4" />
                      <span className="hidden sm:inline">Xem</span>
                    </Button>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="glass rounded-2xl p-8 text-center">
                <Camera className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">
                  Không tìm thấy tài khoản nào có avatar tương tự
                </p>
              </div>
            )}
          </div>
        )}

        {/* Text Search Results */}
        {hasSearched && !hasScanResult && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">
              {results.length > 0
                ? `Tìm thấy ${results.length} kết quả`
                : 'Không tìm thấy kết quả'}
            </h2>

            {results.length > 0 ? (
              <div className="space-y-3">
                {results.map((profile) => (
                  <Link
                    key={profile.id}
                    to={`/profile/${profile.id}`}
                    className="glass rounded-2xl p-4 flex items-center gap-4 hover-lift animate-fade-in block"
                  >
                    <Avatar className="h-14 w-14 ring-2 ring-primary/20">
                      <AvatarImage src={profile.avatar_url || ''} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                        {(profile.display_name || profile.username)?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg truncate">
                        {profile.display_name || profile.username}
                      </h3>
                      <p className="text-muted-foreground truncate">@{profile.username}</p>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                        <Hash className="w-3 h-3" />
                        <span>{profile.user_id_code}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl gap-1"
                        onClick={(e) => {
                          e.preventDefault();
                          window.location.href = `/messages?user=${profile.id}`;
                        }}
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span className="hidden sm:inline">Nhắn tin</span>
                      </Button>
                      <Button
                        size="sm"
                        className="rounded-xl gap-1 gradient-primary"
                        onClick={(e) => {
                          e.preventDefault();
                          window.location.href = `/profile/${profile.id}`;
                        }}
                      >
                        <UserPlus className="w-4 h-4" />
                        <span className="hidden sm:inline">Xem hồ sơ</span>
                      </Button>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="glass rounded-2xl p-8 text-center">
                <SearchIcon className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">
                  Không tìm thấy người dùng nào với từ khóa "{query}"
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default Search;
