import sys
import os

def check_environment():
    print("\n🔍 CHECKING SETUP")
    print("="*60)
    
    # Check packages
    packages = ['requests', 'yaml', 'lxml']
    missing = []
    
    print("\n📦 Checking packages:")
    for pkg in packages:
        try:
            __import__(pkg)
            print(f"   ✓ {pkg}")
        except ImportError:
            print(f"   ✗ {pkg} - MISSING")
            missing.append('pyyaml' if pkg == 'yaml' else pkg)
    
    if missing:
        print(f"\n❌ Missing: {', '.join(missing)}")
        print(f"\n💡 Install with:")
        print(f"   pip install {' '.join(missing)}")
        return False
    
    print("\n✅ All packages installed!")
    return True

if __name__ == "__main__":
    check_environment()
