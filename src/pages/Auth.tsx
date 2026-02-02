import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Sparkles, Bell, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

const signUpSchema = z.object({
  username: z.string().min(3, 'Tên người dùng phải có ít nhất 3 ký tự').max(20, 'Tên người dùng không được quá 20 ký tự').regex(/^[a-zA-Z0-9_]+$/, 'Tên người dùng chỉ được chứa chữ cái, số và dấu gạch dưới'),
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự')
});
const signInSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu')
});
const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const {
    user,
    signIn,
    signUp
  } = useAuth();
  const navigate = useNavigate();

  // Check if IP is banned on component mount
  useEffect(() => {
    const checkBannedIP = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('check-banned-ip');
        if (!error && data?.banned) {
          setIsBanned(true);
          setBanReason(data.reason || 'IP này đã bị chặn');
        }
      } catch (error) {
        console.error('Error checking banned IP:', error);
      }
    };
    checkBannedIP();
  }, []);
  useEffect(() => {
    if (user) {
      navigate('/', {
        replace: true
      });
    }
  }, [user, navigate]);
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const {
      name,
      value
    } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setErrors(prev => ({
      ...prev,
      [name]: ''
    }));
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsLoading(true);
    try {
      if (isLogin) {
        const result = signInSchema.safeParse(formData);
        if (!result.success) {
          const fieldErrors: Record<string, string> = {};
          result.error.errors.forEach(err => {
            if (err.path[0]) {
              fieldErrors[err.path[0] as string] = err.message;
            }
          });
          setErrors(fieldErrors);
          setIsLoading(false);
          return;
        }
        const {
          error
        } = await signIn(formData.email, formData.password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast({
              title: 'Đăng nhập thất bại',
              description: 'Email hoặc mật khẩu không chính xác.',
              variant: 'destructive'
            });
          } else {
            toast({
              title: 'Lỗi',
              description: error.message,
              variant: 'destructive'
            });
          }
        } else {
          toast({
            title: 'Đăng nhập thành công!',
            description: 'Chào mừng bạn trở lại.'
          });
        }
      } else {
        const result = signUpSchema.safeParse(formData);
        if (!result.success) {
          const fieldErrors: Record<string, string> = {};
          result.error.errors.forEach(err => {
            if (err.path[0]) {
              fieldErrors[err.path[0] as string] = err.message;
            }
          });
          setErrors(fieldErrors);
          setIsLoading(false);
          return;
        }
        const {
          error
        } = await signUp(formData.email, formData.password, formData.username);
        if (error) {
          if (error.message.includes('already registered')) {
            toast({
              title: 'Email đã tồn tại',
              description: 'Email này đã được sử dụng. Vui lòng đăng nhập hoặc sử dụng email khác.',
              variant: 'destructive'
            });
          } else {
            toast({
              title: 'Lỗi',
              description: error.message,
              variant: 'destructive'
            });
          }
        } else {
          toast({
            title: 'Đăng ký thành công!',
            description: 'Chào mừng bạn đến với SocialHub.'
          });
        }
      }
    } catch (error) {
      toast({
        title: 'Lỗi',
        description: 'Đã xảy ra lỗi. Vui lòng thử lại.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };
  return <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIyIi8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-primary-foreground/20 backdrop-blur flex items-center justify-center">
              <Bell className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-4xl font-bold text-primary-foreground">Annd</h1>
          </div>
          <h2 className="text-3xl xl:text-4xl font-bold text-primary-foreground mb-6 leading-tight">
            Kết nối với bạn bè,<br />
            chia sẻ khoảnh khắc đáng nhớ
          </h2>
          <p className="text-lg text-primary-foreground/80 mb-8 max-w-md">Tham gia cộng đồng nguòi dùng. Chia sẻ câu chuyện của bạn, kết nối với bạn bè và khám phá nội dung mới mỗi ngày.</p>
          <div className="flex gap-8">
            <div>
              <p className="text-3xl font-bold text-primary-foreground">10K+</p>
              <p className="text-primary-foreground/70">Người dùng</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-primary-foreground">50K+</p>
              <p className="text-primary-foreground/70">Bài viết</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-primary-foreground">99%</p>
              <p className="text-primary-foreground/70">Hài lòng</p>
            </div>
          </div>
        </div>
        <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-primary-foreground/10 rounded-full blur-3xl" />
        <div className="absolute -top-20 -left-20 w-60 h-60 bg-accent/20 rounded-full blur-3xl" />
      </div>

      {/* Right Panel - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          {/* Banned IP Message */}
          {isBanned && (
            <div className="bg-destructive/10 border border-destructive rounded-xl p-6 text-center">
              <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-bold text-destructive mb-2">Bạn đã bị chặn</h2>
              <p className="text-muted-foreground">{banReason}</p>
              <p className="text-sm text-muted-foreground mt-4">
                Bạn không thể đăng ký hoặc đăng nhập từ thiết bị này.
              </p>
            </div>
          )}

          {/* Mobile Logo */}
          {!isBanned && (
            <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
                <Sparkles className="w-6 h-6 text-primary-foreground" />
              </div>
              <span className="text-2xl font-bold gradient-text">Annd</span>
            </div>
          )}

          {!isBanned && (
            <>
              <div className="text-center lg:text-left">
                <h2 className="text-3xl font-bold text-foreground">
                  {isLogin ? 'Chào mừng trở lại!' : 'Tạo tài khoản mới'}
                </h2>
                <p className="mt-2 text-muted-foreground">
                  {isLogin ? 'Đăng nhập để tiếp tục khám phá' : 'Tham gia cộng đồng ngay hôm nay'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {!isLogin && <div className="space-y-2">
                    <Label htmlFor="username" className="text-foreground">
                      Tên người dùng
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input id="username" name="username" type="text" value={formData.username} onChange={handleChange} placeholder="username" className={cn('pl-10 h-12 rounded-xl bg-secondary/50 border-border focus-visible:ring-primary', errors.username && 'border-destructive focus-visible:ring-destructive')} />
                    </div>
                    {errors.username && <p className="text-sm text-destructive">{errors.username}</p>}
                  </div>}

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="email@example.com" className={cn('pl-10 h-12 rounded-xl bg-secondary/50 border-border focus-visible:ring-primary', errors.email && 'border-destructive focus-visible:ring-destructive')} />
                  </div>
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-foreground">
                    Mật khẩu
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input id="password" name="password" type={showPassword ? 'text' : 'password'} value={formData.password} onChange={handleChange} placeholder="••••••••" className={cn('pl-10 pr-10 h-12 rounded-xl bg-secondary/50 border-border focus-visible:ring-primary', errors.password && 'border-destructive focus-visible:ring-destructive')} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                </div>

                <Button type="submit" disabled={isLoading} className="w-full h-12 rounded-xl gradient-primary shadow-glow hover:shadow-lg transition-all text-lg font-semibold gap-2">
                  {isLoading ? <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : <>
                      {isLogin ? 'Đăng nhập' : 'Đăng ký'}
                      <ArrowRight className="w-5 h-5" />
                    </>}
                </Button>
              </form>

              <div className="text-center">
                <p className="text-muted-foreground">
                  {isLogin ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}{' '}
                  <button type="button" onClick={() => {
                  setIsLogin(!isLogin);
                  setErrors({});
                  setFormData({
                    username: '',
                    email: '',
                    password: ''
                  });
                }} className="text-primary font-semibold hover:underline">
                    {isLogin ? 'Đăng ký ngay' : 'Đăng nhập'}
                  </button>
                </p>
              </div>

              {!isLogin && <p className="text-xs text-center text-muted-foreground">
                  Người dùng đầu tiên đăng ký sẽ trở thành Admin với đầy đủ quyền quản trị.
                </p>}
            </>
          )}
        </div>
      </div>
    </div>;
};
export default Auth;