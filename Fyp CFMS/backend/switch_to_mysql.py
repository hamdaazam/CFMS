"""
Helper script to switch to MySQL database
Run: python switch_to_mysql.py
"""
import os

def update_env_file():
    """Update .env file with MySQL password"""
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    
    print("\n" + "="*60)
    print("SWITCH TO MYSQL DATABASE")
    print("="*60)
    
    # Read current .env
    env_vars = {}
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if '=' in line and not line.startswith('#'):
                    key, value = line.split('=', 1)
                    env_vars[key] = value
    
    # Check current DB_PASSWORD
    current_password = env_vars.get('DB_PASSWORD', '')
    
    if current_password:
        print(f"\nMySQL password is already set in .env file")
        print(f"Current password: {'*' * len(current_password)}")
        choice = input("\nDo you want to change it? (y/n): ").strip().lower()
        if choice != 'y':
            print("\nKeeping existing password.")
            return
    else:
        print("\nMySQL password is not set (empty).")
        print("Backend is currently using SQLite database.")
    
    # Get MySQL password
    print("\nEnter your MySQL root password:")
    print("(This is the password you use to connect to MySQL Workbench)")
    password = input("Password: ").strip()
    
    if not password:
        print("\nNo password entered. Keeping SQLite database.")
        return
    
    # Update .env file
    env_vars['DB_PASSWORD'] = password
    
    # Write back to .env
    with open(env_path, 'w') as f:
        f.write("SECRET_KEY=django-insecure-dev-key-change-in-production\n")
        f.write("DEBUG=True\n")
        f.write("ALLOWED_HOSTS=localhost,127.0.0.1\n")
        f.write(f"DB_NAME={env_vars.get('DB_NAME', 'cfms_db')}\n")
        f.write(f"DB_USER={env_vars.get('DB_USER', 'root')}\n")
        f.write(f"DB_PASSWORD={password}\n")
        f.write(f"DB_HOST={env_vars.get('DB_HOST', 'localhost')}\n")
        f.write(f"DB_PORT={env_vars.get('DB_PORT', '3306')}\n")
    
    print("\n" + "="*60)
    print("SUCCESS!")
    print("="*60)
    print("\n.env file updated with MySQL password.")
    print("\nNext steps:")
    print("1. Restart your backend server")
    print("2. Backend will automatically connect to MySQL")
    print("3. All your users from MySQL will be visible!")
    print("\nTo restart backend:")
    print("  - Stop current server (Ctrl+C)")
    print("  - Run: python manage.py runserver 127.0.0.1:8000")

if __name__ == '__main__':
    try:
        update_env_file()
    except KeyboardInterrupt:
        print("\n\nCancelled.")
    except Exception as e:
        print(f"\nError: {e}")

